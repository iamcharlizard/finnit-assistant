import { TransactionType } from '@finnit/database';

const DAY_MS = 86_400_000;
/** The two sides of a transfer between own accounts land this close. */
export const TRANSFER_DAYS_WINDOW = 2;
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

const dayDistance = (a: Date, b: Date) =>
  Math.round(Math.abs(a.getTime() - b.getTime()) / DAY_MS);

/**
 * Whether `other` can be the opposite side of `source`: another account in
 * the same currency, the same amount going the other way, a few days apart.
 */
export function isTransferPair(
  source: TransferMovement,
  other: TransferMovement,
): boolean {
  if (other.id === source.id || other.accountId === source.accountId) {
    return false;
  }
  if (other.currency !== source.currency) return false;
  if (!COUNTERPART_TYPES.includes(other.type)) return false;
  if (source.effect === 0 || other.effect === 0) return false;
  if (Math.sign(source.effect) === Math.sign(other.effect)) return false;
  if (Math.abs(source.amount - other.amount) > AMOUNT_TOLERANCE) return false;
  return dayDistance(source.txnDate, other.txnDate) <= TRANSFER_DAYS_WINDOW;
}

/** The possible other sides, closest date first (then income over others). */
export function rankTransferCandidates<T extends TransferMovement>(
  source: TransferMovement,
  movements: T[],
): T[] {
  return movements
    .filter((movement) => isTransferPair(source, movement))
    .sort(
      (a, b) =>
        dayDistance(source.txnDate, a.txnDate) -
          dayDistance(source.txnDate, b.txnDate) ||
        Number(b.type !== TransactionType.adjustment) -
          Number(a.type !== TransactionType.adjustment) ||
        a.id.localeCompare(b.id),
    );
}

/** Which side of the transfer a movement is: money leaving or arriving. */
export function transferDirection(effect: number): 'out' | 'in' {
  return effect < 0 ? 'out' : 'in';
}
