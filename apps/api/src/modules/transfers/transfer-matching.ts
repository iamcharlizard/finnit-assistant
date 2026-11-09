import { TransactionType } from '@finnit/database';

const DAY_MS = 86_400_000;
/**
 * The two sides of a transfer between own accounts usually land this
 * close: a payment can take a few days to show on the other account (a
 * card payment made on a Friday shows up on Monday or later). Candidates
 * this close are proposed first; farther ones are still offered.
 */
export const TRANSFER_DAYS_WINDOW = 7;
/** How many possible other sides are offered at most. */
export const TRANSFER_CANDIDATES_LIMIT = 20;
/** Same amount, to the cent. */
const AMOUNT_TOLERANCE = 0.01;

/** The movements that can become one side of a transfer. */
export const CONVERTIBLE_TYPES: readonly TransactionType[] = [
  TransactionType.expense,
  TransactionType.income,
];

/**
 * What the other side may have been recorded as: income/expense, or a
 * positive adjustment (a card payment arrives as one).
 */
export const COUNTERPART_TYPES: readonly TransactionType[] = [
  TransactionType.expense,
  TransactionType.income,
  TransactionType.adjustment,
];

/** A movement seen as a possible transfer side. */
export interface TransferMovement {
  id: string;
  accountId: string;
  type: TransactionType;
  /** Absolute amount. */
  amount: number;
  /** Signed effect on its account's balance. */
  effect: number;
  currency: string;
  txnDate: Date;
}

export const dayDistance = (a: Date, b: Date) =>
  Math.round(Math.abs(a.getTime() - b.getTime()) / DAY_MS);

/**
 * Whether `other` can be the opposite side of `source`: another account in
 * the same currency, the same amount going the other way, at most
 * `maxDays` apart (any date when the user picks it by hand).
 */
export function isTransferPair(
  source: TransferMovement,
  other: TransferMovement,
  maxDays: number = TRANSFER_DAYS_WINDOW,
): boolean {
  if (other.id === source.id || other.accountId === source.accountId) {
    return false;
  }
  if (other.currency !== source.currency) return false;
  if (!COUNTERPART_TYPES.includes(other.type)) return false;
  if (source.effect === 0 || other.effect === 0) return false;
  if (Math.sign(source.effect) === Math.sign(other.effect)) return false;
  if (Math.abs(source.amount - other.amount) > AMOUNT_TOLERANCE) return false;
  return dayDistance(source.txnDate, other.txnDate) <= maxDays;
}

/**
 * The possible other sides of any date, closest first (then income over
 * adjustments), at most `limit`.
 */
export function rankTransferCandidates<T extends TransferMovement>(
  source: TransferMovement,
  movements: T[],
  limit: number = TRANSFER_CANDIDATES_LIMIT,
): T[] {
  return movements
    .filter((movement) => isTransferPair(source, movement, Infinity))
    .sort(
      (a, b) =>
        dayDistance(source.txnDate, a.txnDate) -
          dayDistance(source.txnDate, b.txnDate) ||
        Number(b.type !== TransactionType.adjustment) -
          Number(a.type !== TransactionType.adjustment) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, limit);
}

/** Which side of the transfer a movement is: money leaving or arriving. */
export function transferDirection(effect: number): 'out' | 'in' {
  return effect < 0 ? 'out' : 'in';
}
