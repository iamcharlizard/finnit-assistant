/**
 * Shapes of the debts API (feature 6) and the GraphQL field selections that
 * fetch them. Debts carry no currency: the app's home currency is assumed.
 */
export type DebtKind = 'loan' | 'card' | 'other';

export const DEBT_KINDS = [
  'loan',
  'card',
  'other',
] as const satisfies ReadonlyArray<DebtKind>;

export interface ApiDebt {
  id: string;
  name: string;
  kind: DebtKind;
  /** What was borrowed (or owed when it was registered). */
  principal: number;
  /** Percent a year, 0–100. */
  interestRateAnnual: number | null;
  minPaymentAmount: number | null;
  startDate: string | null;
  dueDate: string | null;
  linkedAccountId: string | null;
  /** principal minus the registered payments, never negative. */
  remainingBalance: number;
  totalPaid: number;
  createdAt: string;
}

export const DEBT_FIELDS =
  'id name kind principal interestRateAnnual minPaymentAmount startDate dueDate linkedAccountId remainingBalance totalPaid createdAt';

export type PayoffStrategy = 'avalanche' | 'snowball';

/** One debt in a payoff plan, in the plan's order. */
export interface ApiPayoffProjection {
  debtId: string;
  debtName: string;
  currentBalance: number;
  /** What it gets once it is the priority (minimum + extra + freed minimums). */
  monthlyPayment: number;
  payoffDate: string;
  totalInterest: number;
  /** Null when the payments never pay it off. */
  monthsToPayoff: number | null;
}

export const PAYOFF_FIELDS =
  'debtId debtName currentBalance monthlyPayment payoffDate totalInterest monthsToPayoff';
