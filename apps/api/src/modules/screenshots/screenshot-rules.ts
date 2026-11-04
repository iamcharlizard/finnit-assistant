/**
 * Local rules for a screenshot of a bank app's movement list (e.g. Banamex:
 * "Clásica Banamex **482", then rows "Netflix $299.00" / "02 Nov En proceso").
 * The OCR returns one line per visual row with its box and confidence; a
 * movement is a line that ends in an amount, followed by the line with its
 * date and status. Everything else (tabs, headings, logos) is ignored.
 */
import { parseDate } from '../statements/parsing/parse-utils';

export interface ShotOcrLine {
  text: string;
  /** 0–1 */
  confidence: number;
  /** Four [x, y] corners. */
  box: number[][];
}

/** A field the user should check before saving. */
export type ShotReviewField = 'date' | 'merchant' | 'amount';

export interface ShotMovement {
  /** YYYY-MM-DD, never in the future; null when not read. */
  date: string | null;
  merchant: string | null;
  /** Positive. */
  amount: number | null;
  /** Money out of the account (a purchase) or into it (a payment, refund). */
  direction: 'out' | 'in';
  /** The bank shows it "en proceso" (not applied yet). */
  inProcess: boolean;
  review: ShotReviewField[];
}

export interface ShotExtraction {
  /** "Clásica Banamex **482" */
  accountHint: string | null;
  /** The digits after the asterisks (3 or 4). */
  last4: string | null;
  movements: ShotMovement[];
}

/** Lines read with less confidence than this are flagged for review. */
export const REVIEW_CONFIDENCE = 0.85;

const AMOUNT_AT_END =
  /([+\-−]?)\s*\$\s?(\d{1,3}(?:,\d{3})+(?:\.\d{2})?|\d+(?:\.\d{2})?)\s*(?:mxn)?$/i;
const ACCOUNT_DIGITS = /(?:\*{2,}|•{2,}|·{2,}|x{3,})\s?(\d{3,4})\b/i;
const DATE_AT_START = /^(\d{1,2})\s+([a-záéíóúñ]{3,})\.?(?:\s+(\d{4}))?/i;
const IN_PROCESS = /en proceso|pendiente|procesando|por aplicar|retenid/i;
const MONEY_IN =
  /\b(abono|dep[oó]sito|devoluci[oó]n|reembolso|bonificaci[oó]n|pago recibido|su pago|transferencia recibida)\b/i;

const topOf = (line: ShotOcrLine) => Math.min(...line.box.map((p) => p[1]));
const leftOf = (line: ShotOcrLine) => Math.min(...line.box.map((p) => p[0]));
const clean = (text: string) =>
  text
    .replace(/^[<‹←]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();

/** "02 Nov" as the most recent such day that isn't after today. */
export function shotDate(
  day: string,
  month: string,
  today: Date,
): string | null {
  const year = today.getUTCFullYear();
  const iso = parseDate(`${day} ${month}`, year);
  if (!iso) return null;
  const todayIso = today.toISOString().slice(0, 10);
  return iso <= todayIso ? iso : parseDate(`${day} ${month}`, year - 1);
}

export function extractScreenshot({
  lines,
  today,
}: {
  lines: ReadonlyArray<ShotOcrLine>;
  today: Date;
}): ShotExtraction {
  const sorted = [...lines]
    .filter((line) => line.text.trim())
    .sort((a, b) => topOf(a) - topOf(b) || leftOf(a) - leftOf(b));

  let accountHint: string | null = null;
  let last4: string | null = null;
  const movements: (ShotMovement & { open: boolean })[] = [];

  for (const line of sorted) {
    const text = clean(line.text);
    const lowConfidence = line.confidence < REVIEW_CONFIDENCE;

    // The account comes before the movements.
    if (!movements.length && !last4) {
      const digits = ACCOUNT_DIGITS.exec(text);
      if (digits) {
        accountHint = text;
        last4 = digits[1]!;
        continue;
      }
    }

    const amount = AMOUNT_AT_END.exec(text);
    if (amount) {
      const value = Number(amount[2].replace(/,/g, ''));
      const merchant = clean(text.slice(0, amount.index));
      const review: ShotReviewField[] = [];
      if (!merchant) review.push('merchant');
      if (lowConfidence) review.push('merchant', 'amount');
      const sign = amount[1];
      movements.push({
        date: null,
        merchant: merchant || null,
        amount: value > 0 ? value : null,
        direction:
          sign === '+' || (merchant && MONEY_IN.test(merchant)) ? 'in' : 'out',
        inProcess: false,
        review: value > 0 ? review : [...review, 'amount'],
        open: true,
      });
      continue;
    }

    // The date (and status) line that follows a movement.
    const current = movements.at(-1);
    if (!current?.open) continue;
    const date = DATE_AT_START.exec(text);
    if (date && !current.date) {
      current.date = date[3]
        ? parseDate(`${date[1]} ${date[2]} ${date[3]}`)
        : shotDate(date[1], date[2], today);
      if (!current.date || lowConfidence) current.review.push('date');
      current.inProcess = IN_PROCESS.test(text);
      current.open = false;
    } else if (IN_PROCESS.test(text)) {
      current.inProcess = true;
    }
  }

  return {
    accountHint,
    last4,
    movements: movements.map((movement) => {
      const review = new Set(movement.review);
      if (!movement.date) review.add('date');
      return {
        date: movement.date,
        merchant: movement.merchant,
        amount: movement.amount,
        direction: movement.direction,
        inProcess: movement.inProcess,
        review: [...review],
      };
    }),
  };
}
