/**
 * Linking an expense to the recurring payment it paid (a subscription, a
 * membership, a service…): which scheduled payments to offer and which one
 * to propose. The rules are the bank sync's (`matchOccurrences`): due near
 * the movement's day and a similar amount; the text naming the expense makes
 * it the clear one. Loans have their own flow (debts/loan-links).
 */
import {
  OCCURRENCE_DATE_WINDOW_DAYS,
  fitsRecurringAmount,
  identifiesRecurring,
} from '../statements/reconciliation/matching';
import { normalizeText } from '../statements/parsing/parse-utils';

/** Scheduled payments due this many days from the movement are offered. */
export const LINK_WINDOW_DAYS = OCCURRENCE_DATE_WINDOW_DAYS;

export interface LinkCandidate {
  occurrenceId: string;
  dueDay: string;
  expectedAmount: number;
  isVariableAmount: boolean;
  /** The recurring expense's pattern (or name) appears in the movement's text. */
  nameMatches: boolean;
  /** The recurring expense is paid with the movement's account. */
  sameAccount: boolean;
}

const dayDiff = (a: string, b: string) =>
  Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) /
  86_400_000;

/**
 * The payments the movement may be: due within the window and with a
 * similar amount, the ones its text names first, then the closest in date
 * (and amount). The first is proposed when its text names it or it is the
 * only one.
 */
export function rankLinkCandidates<T extends LinkCandidate>(
  candidates: ReadonlyArray<T>,
  movement: { day: string; amount: number },
): { ranked: T[]; proposed: string | null } {
  const fitting = candidates.filter(
    (c) =>
      dayDiff(c.dueDay, movement.day) <= LINK_WINDOW_DAYS &&
      fitsRecurringAmount(
        movement.amount,
        c.expectedAmount,
        c.isVariableAmount,
      ),
  );
  const ranked = [...fitting].sort(
    (a, b) =>
      Number(b.nameMatches) - Number(a.nameMatches) ||
      dayDiff(a.dueDay, movement.day) - dayDiff(b.dueDay, movement.day) ||
      Math.abs(a.expectedAmount - movement.amount) -
        Math.abs(b.expectedAmount - movement.amount) ||
      Number(b.sameAccount) - Number(a.sameAccount),
  );
  const best = ranked[0];
  const proposed =
    best && (best.nameMatches || ranked.length === 1)
      ? best.occurrenceId
      : null;
  return { ranked, proposed };
}

/** The expense's pattern (or name) appears in the movement's text. */
export function namesMatch(
  movementText: string,
  expense: { name: string; merchantPattern: string | null },
): boolean {
  return identifiesRecurring(normalizeText(movementText), {
    merchantPattern: expense.merchantPattern,
    expenseName: expense.name,
  });
}
