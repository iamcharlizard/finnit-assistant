import {
  merchantKey,
  normalizeMerchant,
} from '../recurring-expenses/suggestions/detect';

/** A scheduled loan payment still waiting for its movement. */
export interface OpenInstallment {
  id: string;
  dueDate: Date;
  expectedAmount: number;
}

/** An expense movement that could be that payment. */
export interface PaymentMovement {
  id: string;
  date: Date;
  amount: number;
  /** Merchant name or description, as the bank printed it. */
  text: string;
}

export interface MatchContext {
  /** Variable payments (purchase financing) allow a wider amount range. */
  variable: boolean;
  /** Merchant pattern, lender and loan name. */
  names: (string | null | undefined)[];
  /** Merchant keys of movements that already paid this loan. */
  knownKeys: ReadonlySet<string>;
}

/**
 * Why a movement was proposed, strongest first: it comes from the same
 * merchant as earlier payments of the loan, its text names the lender, only
 * its amount and date fit, or the AI picked it among similar ones.
 */
export type MatchReason = 'history' | 'text' | 'amount' | 'ai';

export interface PaymentMatch {
  occurrenceId: string;
  transactionId: string;
  /** 0..1. */
  score: number;
  reason: MatchReason;
  /** Other movements fit about as well and nothing names the lender. */
  ambiguous: boolean;
  /** The movements that compete with this one when ambiguous. */
  alternatives: string[];
}

export const MATCH_DATE_WINDOW_DAYS = 10;
const FIXED_TOLERANCE = 0.15;
const VARIABLE_TOLERANCE = 0.5;
/** Scores this close are a tie. */
const TIE = 0.05;
const DAY_MS = 86_400_000;

/** Words that say nothing about who the lender is. */
const GENERIC_WORDS = new Set([
  'PAGO',
  'PAGOS',
  'PRESTAMO',
  'PRESTAMOS',
  'CREDITO',
  'CREDITOS',
  'ABONO',
  'CUOTA',
  'MENSUALIDAD',
  'TRANSFERENCIA',
  'SPEI',
  'FINANCIERA',
  'FINANCIERO',
  'BANCO',
  'MEXICO',
]);

/** Distinctive words of the loan's names ("Préstamo Kubo" → KUBO). */
export function lenderWords(names: MatchContext['names']): string[] {
  const words = new Set<string>();
  for (const name of names) {
    if (!name) continue;
    for (const word of normalizeMerchant(name).split(' ')) {
      if (word.length >= 3 && !GENERIC_WORDS.has(word)) words.add(word);
    }
  }
  return [...words];
}

export function movementKey(text: string): string {
  return merchantKey(normalizeMerchant(text));
}

interface Pair {
  occurrence: OpenInstallment;
  movement: PaymentMovement;
  score: number;
  reason: Exclude<MatchReason, 'ai'>;
}

function score(
  occurrence: OpenInstallment,
  movement: PaymentMovement,
  ctx: MatchContext,
  words: string[],
): Pair | null {
  const expected = occurrence.expectedAmount;
  const tolerance = ctx.variable ? VARIABLE_TOLERANCE : FIXED_TOLERANCE;
  const amountDiff = Math.abs(movement.amount - expected) / expected;
  if (amountDiff > tolerance) return null;
  const dayDiff =
    Math.abs(movement.date.getTime() - occurrence.dueDate.getTime()) / DAY_MS;
  if (dayDiff > MATCH_DATE_WINDOW_DAYS) return null;

  const normalized = normalizeMerchant(movement.text);
  const history = ctx.knownKeys.has(merchantKey(normalized));
  const text = words.some((word) => normalized.split(' ').includes(word));
  const value =
    0.35 * (1 - amountDiff / tolerance) +
    0.25 * (1 - dayDiff / MATCH_DATE_WINDOW_DAYS) +
    (history ? 0.4 : text ? 0.3 : 0);
  return {
    occurrence,
    movement,
    score: Math.round(value * 1000) / 1000,
    reason: history ? 'history' : text ? 'text' : 'amount',
  };
}

/**
 * Proposes one movement per open installment (each movement used once),
 * best pairs first. Deterministic; the caller may ask the AI to settle the
 * ambiguous ones.
 */
export function matchLoanPayments(
  open: OpenInstallment[],
  movements: PaymentMovement[],
  ctx: MatchContext,
): PaymentMatch[] {
  const words = lenderWords(ctx.names);
  const pairs = open
    .flatMap((occurrence) =>
      movements.map((movement) => score(occurrence, movement, ctx, words)),
    )
    .filter((pair): pair is Pair => pair !== null)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.occurrence.dueDate.getTime() - b.occurrence.dueDate.getTime(),
    );

  const usedOccurrences = new Set<string>();
  const usedMovements = new Set<string>();
  const matches: PaymentMatch[] = [];
  for (const pair of pairs) {
    if (
      usedOccurrences.has(pair.occurrence.id) ||
      usedMovements.has(pair.movement.id)
    ) {
      continue;
    }
    usedOccurrences.add(pair.occurrence.id);
    usedMovements.add(pair.movement.id);
    const rivals =
      pair.reason === 'amount'
        ? pairs.filter(
            (other) =>
              other.occurrence.id === pair.occurrence.id &&
              other.movement.id !== pair.movement.id &&
              !usedMovements.has(other.movement.id) &&
              pair.score - other.score <= TIE,
          )
        : [];
    matches.push({
      occurrenceId: pair.occurrence.id,
      transactionId: pair.movement.id,
      score: pair.score,
      reason: pair.reason,
      ambiguous: rivals.length > 0,
      alternatives: rivals.map((r) => r.movement.id),
    });
  }
  return matches.sort((a, b) => b.score - a.score);
}
