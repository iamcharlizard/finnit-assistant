import { ImportedLineKind, TransactionType } from '@finnit/database';
import { DEBIT_KINDS } from '../parsing/parsed-statement';
import { normalizeText } from '../parsing/parse-utils';

const DAY_MS = 86_400_000;
/** A registered transaction may be dated this many days from the statement line. */
export const TRANSACTION_DATE_WINDOW_DAYS = 3;
/** A recurring charge may land this many days from its due date. */
export const OCCURRENCE_DATE_WINDOW_DAYS = 10;
/** Fixed-price subscriptions still match after a price change of up to 15%. */
const FIXED_AMOUNT_TOLERANCE = 0.15;
/** Variable bills (power, water) match within ±50% of the estimate. */
const VARIABLE_AMOUNT_TOLERANCE = 0.5;

export interface LineToMatch {
  id: string;
  date: Date;
  amount: number;
  kind: ImportedLineKind;
  description: string | null;
  merchant: string | null;
}

export interface CandidateTransaction {
  id: string;
  type: TransactionType;
  amount: number;
  txnDate: Date;
  merchantName: string | null;
  description: string | null;
}

export interface CandidateOccurrence {
  id: string;
  dueDate: Date;
  expectedAmount: number;
  expenseName: string;
  merchantPattern: string | null;
  isVariableAmount: boolean;
}

const daysBetween = (a: Date, b: Date) =>
  Math.abs(a.getTime() - b.getTime()) / DAY_MS;

function lineText(line: LineToMatch): string {
  return normalizeText(`${line.merchant ?? ''} ${line.description ?? ''}`);
}

/** Shared words of 3+ letters: a tie-breaker between same-amount candidates. */
function similarity(a: string, b: string): number {
  const words = new Set(a.split(' ').filter((w) => w.length >= 3));
  return b.split(' ').filter((w) => w.length >= 3 && words.has(w)).length;
}

function typeMatches(kind: ImportedLineKind, type: TransactionType): boolean {
  if (DEBIT_KINDS.has(kind)) return type === TransactionType.expense;
  // Payments and refunds increase the card balance.
  return (
    type === TransactionType.income ||
    type === TransactionType.adjustment ||
    type === TransactionType.transfer
  );
}

/**
 * Links statement lines to transactions already registered in the app: same
 * amount, compatible direction and a close date. Each transaction is used once.
 * Returns lineId → transactionId.
 */
export function matchTransactions(
  lines: LineToMatch[],
  candidates: CandidateTransaction[],
): Map<string, string> {
  const result = new Map<string, string>();
  const available = new Set(candidates.map((c) => c.id));

  for (const line of lines) {
    const text = lineText(line);
    let best: { id: string; days: number; score: number } | undefined;

    for (const candidate of candidates) {
      if (!available.has(candidate.id)) continue;
      if (Math.abs(candidate.amount - line.amount) > 0.01) continue;
      if (!typeMatches(line.kind, candidate.type)) continue;
      const days = daysBetween(candidate.txnDate, line.date);
      if (days > TRANSACTION_DATE_WINDOW_DAYS) continue;

      const score = similarity(
        text,
        normalizeText(
          `${candidate.merchantName ?? ''} ${candidate.description ?? ''}`,
        ),
      );
      if (
        !best ||
        days < best.days ||
        (days === best.days && score > best.score)
      ) {
        best = { id: candidate.id, days, score };
      }
    }

    if (best) {
      result.set(line.id, best.id);
      available.delete(best.id);
    }
  }
  return result;
}

function identifies(
  line: LineToMatch,
  occurrence: CandidateOccurrence,
): boolean {
  const text = lineText(line);
  if (occurrence.merchantPattern) {
    return text.includes(normalizeText(occurrence.merchantPattern));
  }
  // Without a pattern, the expense name must appear in the line.
  const name = normalizeText(occurrence.expenseName);
  return name.length >= 3 && text.includes(name);
}

function amountFits(
  line: LineToMatch,
  occurrence: CandidateOccurrence,
): boolean {
  const tolerance = occurrence.isVariableAmount
    ? VARIABLE_AMOUNT_TOLERANCE
    : FIXED_AMOUNT_TOLERANCE;
  const expected = occurrence.expectedAmount;
  return Math.abs(line.amount - expected) <= Math.max(1, expected * tolerance);
}

/**
 * Links debit lines to the recurring payments they settle (e.g. the monthly
 * Netflix charge). Each occurrence is used once; the closest due date wins.
 * Returns lineId → occurrenceId.
 */
export function matchOccurrences(
  lines: LineToMatch[],
  occurrences: CandidateOccurrence[],
): Map<string, string> {
  const result = new Map<string, string>();
  const available = new Set(occurrences.map((o) => o.id));

  for (const line of lines) {
    if (!DEBIT_KINDS.has(line.kind)) continue;
    let best: { id: string; days: number } | undefined;

    for (const occurrence of occurrences) {
      if (!available.has(occurrence.id)) continue;
      const days = daysBetween(occurrence.dueDate, line.date);
      if (days > OCCURRENCE_DATE_WINDOW_DAYS) continue;
      if (!identifies(line, occurrence) || !amountFits(line, occurrence)) {
        continue;
      }
      if (!best || days < best.days) best = { id: occurrence.id, days };
    }

    if (best) {
      result.set(line.id, best.id);
      available.delete(best.id);
    }
  }
  return result;
}
