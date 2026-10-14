import { ReceiptConfidence, ReceiptRoute } from '@finnit/database';

/**
 * Local extraction of a receipt photo's OCR text: CFDI QR, total, date,
 * merchant tax ID (RFC), merchant name and last 4 card digits. Pure
 * functions, no I/O (see docs/document-ocr.md, "Fotos de tickets").
 */

/** Fields of the SAT verification QR printed on a CFDI. */
export interface CfdiQr {
  /** Folio fiscal (UUID), uppercase. */
  uuid: string;
  /** RFC of the issuer (the merchant). */
  issuerTaxId: string;
  /** RFC of the receiver (often the generic XAXX010101000). */
  receiverTaxId?: string;
  total: number;
  /** Last 8 characters of the CFDI seal (CFDI 3.3+). */
  sealTail?: string;
}

export interface ReceiptExtraction {
  route: ReceiptRoute;
  confidence: ReceiptConfidence;
  total?: number;
  subtotal?: number;
  tax?: number;
  /** YYYY-MM-DD */
  date?: string;
  merchantName?: string;
  merchantTaxId?: string;
  cardLast4?: string;
  cfdi?: CfdiQr;
  checks: ReceiptChecks;
}

export interface ReceiptChecks {
  /** A line labelled as the total was found (not just any amount). */
  totalLabelFound: boolean;
  /** subtotal + taxes = total, or subtotal = total with tax included. */
  subtotalTaxMatches: boolean;
  /** The OCR total agrees with the QR total; null without a QR. */
  qrTotalMatches: boolean | null;
}

export interface ReceiptRulesInput {
  /** OCR lines in reading order. */
  lines: string[];
  /** Decoded QR / barcode texts. */
  codes?: string[];
  /** "Today" for date validation (date-only, UTC midnight). */
  today?: Date;
  /** Known RFC → merchant name (user's table first, then globals). */
  knownTaxIds?: ReadonlyMap<string, string>;
}

const MONEY_TOLERANCE = 0.05;
const MAX_RECEIPT_AGE_DAYS = 2 * 366;
const MS_PER_DAY = 86_400_000;

/** RFCs that never identify a merchant (general public / foreigners). */
const GENERIC_TAX_IDS = new Set(['XAXX010101000', 'XEXX010101000']);

const UUID = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/;

// ---------------------------------------------------------------- CFDI QR

/**
 * Parses the verification URL of a CFDI's QR, e.g.
 * https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id=…&re=…&rr=…&tt=…&fe=…
 * (CFDI 3.3/4.0) or the older "?re=…&rr=…&tt=0000001234.560000&id=…".
 */
export function parseCfdiQr(text: string): CfdiQr | null {
  // "+" is part of the base64 seal ("fe"), not an encoded space.
  const query = text
    .trim()
    .replace(/&amp;/gi, '&')
    .split('?')[1]
    ?.replace(/\+/g, '%2B');
  if (!query) return null;
  const params = new Map<string, string>();
  for (const [key, value] of new URLSearchParams(query)) {
    params.set(key.toLowerCase(), value.trim());
  }

  const uuid = params.get('id')?.toUpperCase();
  const issuer = normalizeTaxId(params.get('re') ?? '');
  const total = Number(params.get('tt'));
  if (!uuid || !UUID.test(uuid) || !issuer || !Number.isFinite(total)) {
    return null;
  }
  if (total < 0) return null;
  const receiver = normalizeTaxId(params.get('rr') ?? '') ?? undefined;
  const seal = params.get('fe');
  return {
    uuid,
    issuerTaxId: issuer,
    receiverTaxId: receiver,
    total: roundMoney(total),
    sealTail: seal && /^[A-Za-z0-9+/=]{8}$/.test(seal) ? seal : undefined,
  };
}

// ---------------------------------------------------------------- amounts

/**
 * Amounts with cents as printed on receipts: "$1,234.56", "1234.56",
 * "1 234.56", "120,00" (comma decimal), "$ 99.90" or "2.708.20" (OCR read
 * the thousands comma as a period). Amounts without cents are ignored: on a
 * receipt they are usually quantities, codes or percents.
 */
const AMOUNT =
  /(?<![\d.,])-?\$?\s?(\d{1,3}(?:[,.\s]\d{3})+|\d+)\s?[.,]\s?(\d{2})(?![\d%])/g;

export function findAmounts(line: string): number[] {
  const amounts: number[] = [];
  for (const match of line.matchAll(AMOUNT)) {
    const whole = match[1].replace(/[,.\s]/g, '');
    const value = Number(`${whole}.${match[2]}`);
    if (Number.isFinite(value)) amounts.push(value);
  }
  return amounts;
}

// ---------------------------------------------------------------- labels

/** Uppercase, no accents, OCR's 0-for-O fixed inside words. */
function normalizeLine(line: string): string {
  return line
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/(?<=[A-Z])0|0(?=[A-Z]{2})/g, 'O')
    .replace(/\s+/g, ' ')
    .trim();
}

const TOTAL_LABEL = /\bT\s?O\s?T\s?A\s?[LI1]\b|\bA PAGAR\b/;
/** "SUBTOTAL", or "IMPORTE" opening a line (small shops: Importe / IVA / Total). */
const SUBTOTAL_LABEL = /\bSUB[\s.-]?TOTAL\b|^IMPORTE\b(?!.*\bTOTAL\b)/;
const TAX_LABEL = /\b(I\.?V\.?A|IEPS)\b/;
/** Lines whose amount is not what was paid for the goods. */
const NOT_TOTAL =
  /\b(SUB[\s.-]?TOTAL|I\.?V\.?A|IEPS|CAMBIO|SU CAMBIO|EFECTIVO|PAGOS?|PAGA|RECIBIDO|AHORRO|AHORRASTE|DESCUENTO|DESC|ARTICULOS?|ARTS?|PIEZAS|PZAS?|PUNTOS|SALDO|PROPINA|REDONDEO|DONATIVO|IMPUESTOS?)\b/;

/**
 * Amounts of the lines that match `label` (and not `exclude`): after the
 * label on the same line, or on the next lines when the OCR split the label
 * from its amount. `exclude` looks at the label, a couple of words before it
 * ("SUB TOTAL", "AHORRO TOTAL") and what follows; text further left belongs
 * to another column ("15 ARTICULOS   GRAN TOTAL 120.00").
 */
function labelledAmounts(
  lines: string[],
  label: RegExp,
  exclude?: RegExp,
): number[] {
  const amounts: number[] = [];
  lines.forEach((raw, index) => {
    const line = normalizeLine(raw);
    const match = label.exec(line);
    if (!match) return;
    if (exclude?.test(line.slice(Math.max(0, match.index - 12)))) return;
    const own = findAmounts(line.slice(match.index));
    if (own.length > 0) {
      amounts.push(own[own.length - 1]);
      return;
    }
    // "TOTAL" alone: its amount is on the next line that has only an amount.
    for (const next of lines.slice(index + 1, index + 3)) {
      const nextAmounts = findAmounts(next);
      const onlyAmount =
        nextAmounts.length === 1 &&
        !/[A-Z]{3,}/.test(
          normalizeLine(next).replace(/\b(MXN|MN|M N|PESOS)\b/g, ''),
        );
      if (onlyAmount) {
        amounts.push(nextAmounts[0]);
        return;
      }
      if (nextAmounts.length > 0) return;
    }
  });
  return amounts;
}

export interface TotalsResult {
  total?: number;
  subtotal?: number;
  tax?: number;
  totalLabelFound: boolean;
  subtotalTaxMatches: boolean;
}

/**
 * Total = the largest amount among total-labelled lines (TOTAL, TOTAL A
 * PAGAR, IMPORTE TOTAL…), excluding SUBTOTAL, IVA, CAMBIO, EFECTIVO, PAGO,
 * AHORRO… Cross-checks subtotal + taxes.
 */
export function findTotals(lines: string[]): TotalsResult {
  const totals = labelledAmounts(lines, TOTAL_LABEL, NOT_TOTAL).filter(
    (value) => value > 0,
  );
  const subtotals = labelledAmounts(lines, SUBTOTAL_LABEL).filter(
    (value) => value > 0,
  );
  // Each tax line once ("IVA 16% 16.00"); "IVA INCLUIDO" lines count too.
  const taxes = labelledAmounts(
    lines,
    TAX_LABEL,
    /\bTOTAL\b(?!.*\bI\.?V\.?A\b)/,
  );

  const total = totals.length > 0 ? Math.max(...totals) : undefined;
  const subtotal = subtotals.length > 0 ? Math.max(...subtotals) : undefined;
  const tax =
    taxes.length > 0
      ? roundMoney(taxes.reduce((sum, value) => sum + value, 0))
      : undefined;

  let subtotalTaxMatches = false;
  if (total !== undefined && subtotal !== undefined) {
    const sumMatches =
      tax !== undefined && near(subtotal + tax, total, MONEY_TOLERANCE);
    // Prices with tax included: SUBTOTAL equals TOTAL and IVA is informative.
    const included =
      near(subtotal, total, MONEY_TOLERANCE) &&
      (tax === undefined || tax < total);
    subtotalTaxMatches = sumMatches || included;
  }
  return {
    total,
    subtotal,
    tax,
    totalLabelFound: totals.length > 0,
    subtotalTaxMatches,
  };
}

// ---------------------------------------------------------------- dates

const MONTHS: Record<string, number> = {
  ENE: 1,
  JAN: 1,
  ENERO: 1,
  FEB: 2,
  FEBRERO: 2,
  MAR: 3,
  MARZO: 3,
  ABR: 4,
  APR: 4,
  ABRIL: 4,
  MAY: 5,
  MAYO: 5,
  JUN: 6,
  JUNIO: 6,
  JUL: 7,
  JULIO: 7,
  AGO: 8,
  AUG: 8,
  AGOSTO: 8,
  SEP: 9,
  SEPT: 9,
  SET: 9,
  SEPTIEMBRE: 9,
  SETIEMBRE: 9,
  OCT: 10,
  OCTUBRE: 10,
  NOV: 11,
  NOVIEMBRE: 11,
  DIC: 12,
  DEC: 12,
  DICIEMBRE: 12,
};

const NUMERIC_DATE =
  /(?<!\d)(\d{1,2})\s?[/.-]\s?(\d{1,2})\s?[/.-]\s?(\d{4}|\d{2})(?!\d)/g;
const ISO_DATE = /(?<!\d)(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})(?!\d)/g;
const NAMED_DATE =
  /(?<!\d)(\d{1,2})(?:\s?[/.-]\s?|\s+(?:DE\s+)?)([A-Z]{3,10})\.?(?:\s?[/.-]\s?|\s+(?:DE(?:L)?\s+)?)(\d{4}|\d{2})(?!\d)/g;

function isoDate(year: number, month: number, day: number): string | null {
  if (year < 100) year += 2000;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

/**
 * Candidate dates of one line, best first. Day-first (Mexico); a date that
 * is only valid month-first ("12/25/2026") is read that way.
 */
function datesIn(line: string): string[] {
  const text = normalizeLine(line);
  const found: string[] = [];
  for (const m of text.matchAll(ISO_DATE)) {
    const date = isoDate(Number(m[1]), Number(m[2]), Number(m[3]));
    if (date) found.push(date);
  }
  for (const m of text.matchAll(NAMED_DATE)) {
    const month = MONTHS[m[2]] ?? MONTHS[m[2].slice(0, 3)];
    const date = month ? isoDate(Number(m[3]), month, Number(m[1])) : null;
    if (date) found.push(date);
  }
  for (const m of text.matchAll(NUMERIC_DATE)) {
    const [a, b, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const dayFirst = isoDate(year, b, a);
    const monthFirst = isoDate(year, a, b);
    if (dayFirst) found.push(dayFirst);
    if (monthFirst && monthFirst !== dayFirst) found.push(monthFirst);
  }
  return found;
}

/**
 * The purchase date: never in the future, at most ~2 years old. Dates on a
 * line labelled FECHA win; otherwise the first valid one.
 */
export function findDate(lines: string[], today: Date): string | undefined {
  const todayIso = today.toISOString().slice(0, 10);
  const oldest = new Date(today.getTime() - MAX_RECEIPT_AGE_DAYS * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);
  const valid = (date: string) => date <= todayIso && date >= oldest;

  let first: string | undefined;
  for (const line of lines) {
    const dates = datesIn(line).filter(valid);
    if (dates.length === 0) continue;
    if (/\bFECHA\b/.test(normalizeLine(line))) return dates[0];
    first ??= dates[0];
  }
  return first;
}

// ---------------------------------------------------------------- tax IDs

/** Persona moral: 3 letters; persona física: 4 letters. Then YYMMDD + 3. */
const TAX_ID_CANDIDATE = /[A-Z&Ñ01]{3,4}[\s-]?[0-9OIL]{6}[\s-]?[A-Z0-9]{3}/g;

/** Validates an RFC (fixing OCR's O/0 and I/1 mix-ups); null if invalid. */
export function normalizeTaxId(raw: string): string | null {
  const text = raw.toUpperCase().replace(/[\s-]/g, '');
  if (text.length !== 12 && text.length !== 13) return null;
  const letters = text.length - 9;
  const prefix = text.slice(0, letters).replace(/0/g, 'O').replace(/1/g, 'I');
  const digits = text
    .slice(letters, letters + 6)
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
  const tail = text.slice(letters + 6);
  if (!/^[A-Z&Ñ]+$/.test(prefix) || !/^\d{6}$/.test(digits)) return null;
  if (!/^[A-Z0-9]{3}$/.test(tail)) return null;
  const month = Number(digits.slice(2, 4));
  const day = Number(digits.slice(4, 6));
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${prefix}${digits}${tail}`;
}

/** The merchant's RFC: the first valid, non-generic one (header first). */
export function findTaxId(lines: string[]): string | undefined {
  for (const raw of lines) {
    const line = normalizeLine(raw).replace(/R\.?\s?F\.?\s?C\.?\s*:?/g, ' ');
    for (const match of line.matchAll(TAX_ID_CANDIDATE)) {
      const taxId = normalizeTaxId(match[0]);
      if (taxId && !GENERIC_TAX_IDS.has(taxId)) return taxId;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------- card

const MASKED_CARD = /(?:[*Xx#•]\s?){3,}[\s-]*(\d{4})(?!\d)/;
const LABELLED_CARD =
  /\b(?:TARJETA|TARJ|TERMINACION|TERM|NO\.? DE TARJETA|VISA|MASTERCARD|MASTER CARD|AMEX|AMERICAN EXPRESS|DEBITO|CREDITO)\b[^0-9\n]{0,24}(\d{4})(?!\d)/;

/** Last 4 digits of the card used to pay ("****1234", "TARJETA … 1234"). */
export function findCardLast4(lines: string[]): string | undefined {
  for (const raw of lines) {
    const masked = MASKED_CARD.exec(raw);
    if (masked) return masked[1];
  }
  for (const raw of lines) {
    const labelled = LABELLED_CARD.exec(normalizeLine(raw));
    // A bare year after "TARJETA" is not a card number.
    if (labelled && !/^20\d\d$/.test(labelled[1])) return labelled[1];
  }
  return undefined;
}

// ---------------------------------------------------------------- merchant

/** Chains recognized by name when the RFC is missing or unreadable. */
const KNOWN_CHAINS: { pattern: RegExp; name: string }[] = [
  { pattern: /\bOXXO\b/, name: 'OXXO' },
  { pattern: /\bWAL[\s-]?MART\b/, name: 'Walmart' },
];

const HEADER_NOISE =
  /\b(R\.?\s?F\.?\s?C|TICKET|FACTURA|FOLIO|BIENVENID[OA]S?|GRACIAS|SUCURSAL|TIENDA\s?#|CAJA|CAJERO|TEL|TELEFONO|C\.?\s?P\.?|CALLE|AV|AVENIDA|COL|COLONIA|BLVD|CARR|KM|NUM|MEXICO|CDMX|REGIMEN|LUGAR DE EXPEDICION|FECHA|HORA|TRANSACCION|TRANS|TERMINAL|ORDEN|MESA)\b/;
const LEGAL_SUFFIX =
  /[\s,]+(S\.?\s?A\.?\s?P?\.?\s?I?\.?\s?(DE\s+)?C\.?\s?V\.?|S\.?\s?DE\s+R\.?\s?L\.?(\s?DE\s+C\.?\s?V\.?)?|S\.?\s?C\.?|A\.?\s?C\.?)\s*$/i;
/** "… S.A. DE C.V. SUCURSAL …": the legal entity type and whatever follows. */
const LEGAL_ENTITY =
  /[\s,]+(S\.?\s?A\.?\s?P?\.?\s?I?\.?\s?(DE\s*)?C\.?\s?V\.?|S\.?\s?DE\s+R\.?\s?L\.?)(\s|$).*$/i;
/** A store / branch code ("E01531", "T1234"), not a business name. */
const CODE_TOKEN = /\b[A-Z]{0,2}\d{4,}\b/;

/** The first header line that looks like a business name. */
export function findHeaderName(lines: string[]): string | undefined {
  for (const raw of lines.slice(0, 8)) {
    const text = raw.replace(/\s+/g, ' ').trim().replace(LEGAL_ENTITY, '');
    const normalized = normalizeLine(text);
    const letters = normalized.replace(/[^A-Z]/g, '').length;
    if (letters < 3 || letters < normalized.replace(/\s/g, '').length / 2) {
      continue;
    }
    if (HEADER_NOISE.test(normalized) || CODE_TOKEN.test(normalized)) continue;
    if (findAmounts(text).length > 0 || datesIn(text).length > 0) continue;
    const name = text
      .replace(LEGAL_SUFFIX, '')
      .replace(/[*=_~-]{2,}/g, '')
      .trim();
    if (name.length >= 3) return name.slice(0, 80);
  }
  return undefined;
}

// ---------------------------------------------------------------- all

export function receiptConfidence(fields: {
  total?: number;
  date?: string;
  checks: Pick<ReceiptChecks, 'subtotalTaxMatches' | 'qrTotalMatches'>;
  hasQrTotal?: boolean;
}): ReceiptConfidence {
  if (fields.total === undefined || !fields.date) return ReceiptConfidence.low;
  const crossChecked =
    Boolean(fields.hasQrTotal) ||
    fields.checks.qrTotalMatches === true ||
    fields.checks.subtotalTaxMatches;
  return crossChecked ? ReceiptConfidence.high : ReceiptConfidence.medium;
}

/**
 * Runs every rule. A valid CFDI QR wins for total and RFC (they are exact);
 * the OCR text gives the rest.
 */
export function extractReceipt(input: ReceiptRulesInput): ReceiptExtraction {
  const lines = input.lines.map((line) => line.trim()).filter(Boolean);
  const today = input.today ?? todayUtc();

  const cfdi = (input.codes ?? [])
    .map(parseCfdiQr)
    .find((qr): qr is CfdiQr => qr !== null);
  const totals = findTotals(lines);
  const date = findDate(lines, today);
  const taxId = cfdi?.issuerTaxId ?? findTaxId(lines);
  const text = normalizeLine(lines.join('\n'));

  const merchantName =
    (taxId && input.knownTaxIds?.get(taxId)) ||
    KNOWN_CHAINS.find((chain) => chain.pattern.test(text))?.name ||
    findHeaderName(lines);

  const total = cfdi ? cfdi.total : totals.total;
  const checks: ReceiptChecks = {
    totalLabelFound: totals.totalLabelFound,
    subtotalTaxMatches: totals.subtotalTaxMatches,
    qrTotalMatches:
      cfdi && totals.total !== undefined
        ? near(cfdi.total, totals.total, 0.01)
        : cfdi
          ? false
          : null,
  };

  return {
    route: cfdi ? ReceiptRoute.cfdi_qr : ReceiptRoute.ocr_rules,
    confidence: receiptConfidence({
      total,
      date,
      checks,
      hasQrTotal: Boolean(cfdi),
    }),
    total,
    subtotal: totals.subtotal,
    tax: totals.tax,
    date,
    merchantName: merchantName || undefined,
    merchantTaxId: taxId,
    cardLast4: findCardLast4(lines),
    cfdi,
    checks,
  };
}

function near(a: number, b: number, tolerance: number): boolean {
  return Math.abs(a - b) <= tolerance;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function todayUtc(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}
