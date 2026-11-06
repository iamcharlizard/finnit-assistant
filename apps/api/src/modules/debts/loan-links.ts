/**
 * Pure rules for linking expense movements to loan payments: which payment
 * fits a movement and which movements fit a payment. No database here.
 */
import { normalizeMerchant } from '../recurring-expenses/suggestions/detect';
import { lenderWords, movementKey } from './payment-matching';

const DAY_MS = 86_400_000;

/** A payment of the movement's own day is the suggestion. */
export const SUGGEST_WINDOW_DAYS = 10;
/** Movements this far from a payment's date are proposed for it. */
export const CANDIDATE_WINDOW_DAYS = 30;
/** How far a movement's amount may be from the payment's. */
export const FIXED_AMOUNT_TOLERANCE = 0.1;
/** Purchase financing pays different amounts each time. */
export const VARIABLE_AMOUNT_TOLERANCE = 0.5;
/** Within this, the amount counts as the payment's own. */
const EXACT_CENTS = 0.5;

export type LinkTargetState = 'open' | 'overdue' | 'paid_without_movement';

export interface LinkTargetInput {
  occurrenceId: string;
  dueDate: Date;
  amount: number;
  state: LinkTargetState;
}

export interface LinkLoanInput {
  debtId: string;
  names: (string | null | undefined)[];
  /** Merchant keys of movements that already paid this loan. */
  knownKeys: ReadonlySet<string>;
  variable: boolean;
  targets: LinkTargetInput[];
}

export interface LinkMovement {
  /** The movement's calendar day (date-only, UTC midnight). */
  day: Date;
  amount: number;
  text: string;
}

export interface RankedLoan {
  debtId: string;
  /** Closest to the movement's day first. */
  targets: LinkTargetInput[];
  suggestedOccurrenceId: string | null;
  /** Its text names the lender or a past payment's merchant. */
  nameMatch: boolean;
  score: number;
}

const days = (a: Date, b: Date) => Math.abs(a.getTime() - b.getTime()) / DAY_MS;

const sameDay = (a: Date, b: Date) =>
  a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);

/** Its text shares a distinctive word with the loan, or a past payment's merchant. */
export function namesMatch(
  text: string,
  names: (string | null | undefined)[],
  knownKeys: ReadonlySet<string>,
): boolean {
  const normalized = normalizeMerchant(text);
  if (!normalized) return false;
  if (knownKeys.has(movementKey(text))) return true;
  const words = normalized.split(' ');
  return lenderWords(names).some((word) => words.includes(word));
}

function amountDiff(amount: number, expected: number): number {
  if (expected <= 0) return amount > 0 ? Infinity : 0;
  return Math.abs(Math.abs(amount) - expected) / expected;
}

/**
 * Loans a movement could pay, best first, each with the payment to
 * suggest: one due the movement's own day, else an open one close in date
 * and amount. Loans without payments to link are left out.
 */
export function rankLoansForMovement(
  movement: LinkMovement,
  loans: LinkLoanInput[],
): RankedLoan[] {
  const ranked = loans
    .filter((loan) => loan.targets.length > 0)
    .map((loan): RankedLoan => {
      const tolerance = loan.variable
        ? VARIABLE_AMOUNT_TOLERANCE
        : FIXED_AMOUNT_TOLERANCE;
      const targets = [...loan.targets].sort(
        (a, b) =>
          days(a.dueDate, movement.day) - days(b.dueDate, movement.day) ||
          a.dueDate.getTime() - b.dueDate.getTime(),
      );
      const exactDay = targets.find((t) => sameDay(t.dueDate, movement.day));
      const near = targets.find(
        (t) =>
          t.state !== 'paid_without_movement' &&
          days(t.dueDate, movement.day) <= SUGGEST_WINDOW_DAYS &&
          amountDiff(movement.amount, t.amount) <= tolerance,
      );
      const suggestion = exactDay ?? near ?? null;
      const nameMatch = namesMatch(movement.text, loan.names, loan.knownKeys);
      const fitsAmount = suggestion
        ? amountDiff(movement.amount, suggestion.amount) <= tolerance
        : false;
      const score =
        (exactDay ? 0.4 : near ? 0.3 : 0) +
        (nameMatch ? 0.4 : 0) +
        (fitsAmount ? 0.2 : 0);
      return {
        debtId: loan.debtId,
        targets,
        suggestedOccurrenceId: suggestion?.occurrenceId ?? null,
        nameMatch,
        score: Math.round(score * 1000) / 1000,
      };
    });
  return ranked.sort((a, b) => b.score - a.score);
}

/** The loan to preselect: the best one when something points at it. */
export function suggestedLoan(ranked: RankedLoan[]): RankedLoan | null {
  const best = ranked[0];
  if (!best) return null;
  return best.nameMatch || best.suggestedOccurrenceId ? best : null;
}

export interface CandidateMovement {
  id: string;
  date: Date;
  amount: number;
  text: string;
}

export interface CandidateContext {
  dueDate: Date;
  expected: number;
  variable: boolean;
  names: (string | null | undefined)[];
  knownKeys: ReadonlySet<string>;
  /** A text search: any amount and date fit, ranked the same way. */
  searching: boolean;
}

export interface RankedCandidate {
  id: string;
  nameMatch: boolean;
  exactAmount: boolean;
  score: number;
}

/**
 * Movements that could be this payment: close in amount (and date) to it,
 * those whose text names the loan first. A search drops the amount and date
 * limits (the caller already filtered by text).
 */
export function rankExpenseCandidates(
  movements: CandidateMovement[],
  ctx: CandidateContext,
): RankedCandidate[] {
  const tolerance = ctx.variable
    ? VARIABLE_AMOUNT_TOLERANCE
    : FIXED_AMOUNT_TOLERANCE;
  const ranked: RankedCandidate[] = [];
  for (const movement of movements) {
    const diff = amountDiff(movement.amount, ctx.expected);
    const dayDiff = days(movement.date, ctx.dueDate);
    if (
      !ctx.searching &&
      (diff > tolerance || dayDiff > CANDIDATE_WINDOW_DAYS)
    ) {
      continue;
    }
    const nameMatch = namesMatch(movement.text, ctx.names, ctx.knownKeys);
    const value =
      0.4 * Math.max(0, 1 - diff / tolerance) +
      (nameMatch ? 0.4 : 0) +
      0.2 * Math.max(0, 1 - dayDiff / CANDIDATE_WINDOW_DAYS);
    ranked.push({
      id: movement.id,
      nameMatch,
      exactAmount:
        Math.abs(Math.abs(movement.amount) - ctx.expected) <= EXACT_CENTS,
      score: Math.round(value * 1000) / 1000,
    });
  }
  return ranked.sort((a, b) => b.score - a.score);
}
