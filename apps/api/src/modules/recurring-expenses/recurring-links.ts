/**
 * Linking an expense to the recurring payment it paid (a subscription, a
 * membership, a service…): which scheduled payments to offer and which one
 * to propose. Loans have their own flow (debts/loan-links).
 */

/** How far from the movement's day a scheduled payment is offered. */
export const LINK_WINDOW_DAYS = 45;
/** Proposed when this close in date and amount. */
export const PROPOSE_DAYS = 10;
export const PROPOSE_AMOUNT_SHARE = 0.15;

export interface LinkCandidate {
  occurrenceId: string;
  dueDay: string;
  expectedAmount: number;
  /** The recurring expense is paid with the movement's account. */
  sameAccount: boolean;
  /** The recurring expense's text matches the movement's. */
  nameMatches: boolean;
}

const dayDiff = (a: string, b: string) =>
  Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) /
  86_400_000;

/** Lower is closer: days apart, amount share apart, account and name. */
export function linkScore(
  candidate: LinkCandidate,
  movement: { day: string; amount: number },
): number {
  const days = dayDiff(candidate.dueDay, movement.day);
  const amountShare =
    Math.abs(candidate.expectedAmount - movement.amount) /
    Math.max(movement.amount, 0.01);
  return (
    days +
    amountShare * 30 -
    (candidate.sameAccount ? 5 : 0) -
    (candidate.nameMatches ? 15 : 0)
  );
}

/** Closest first; the first is proposed when it is clearly the one. */
export function rankLinkCandidates<T extends LinkCandidate>(
  candidates: ReadonlyArray<T>,
  movement: { day: string; amount: number },
): { ranked: T[]; proposed: string | null } {
  const ranked = [...candidates].sort(
    (a, b) => linkScore(a, movement) - linkScore(b, movement),
  );
  const best = ranked[0];
  const proposed =
    best &&
    (best.nameMatches ||
      (dayDiff(best.dueDay, movement.day) <= PROPOSE_DAYS &&
        Math.abs(best.expectedAmount - movement.amount) <=
          movement.amount * PROPOSE_AMOUNT_SHARE))
      ? best.occurrenceId
      : null;
  return { ranked, proposed };
}

const normalize = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

/** The expense's pattern (or name) appears in the movement's text. */
export function namesMatch(
  movementText: string,
  expense: { name: string; merchantPattern: string | null },
): boolean {
  const text = normalize(movementText);
  const needles = [expense.merchantPattern, expense.name]
    .map((n) => (n ? normalize(n).trim() : ''))
    .filter((n) => n.length >= 3);
  return needles.some((n) => text.includes(n));
}
