import type { OccurrenceStatus, RecurringKind } from '@/lib/finance/types';

/**
 * Shapes of the recurring-payments API (feature 15) and the GraphQL field
 * selections that fetch them.
 */
export type RecurringFrequency =
  | 'weekly'
  | 'biweekly'
  | 'semimonthly'
  | 'monthly'
  | 'bimonthly'
  | 'quarterly'
  | 'semiannual'
  | 'yearly';

export type RecurringTrackingMode = 'automatic' | 'manual' | 'reminder';

export const RECURRING_KINDS = [
  'subscription',
  'utility',
  'housing',
  'loan',
  'installment',
  'insurance',
  'membership',
  'other',
] as const satisfies ReadonlyArray<RecurringKind>;

export const RECURRING_FREQUENCIES = [
  'weekly',
  'biweekly',
  'semimonthly',
  'monthly',
  'bimonthly',
  'quarterly',
  'semiannual',
  'yearly',
] as const satisfies ReadonlyArray<RecurringFrequency>;

export const TRACKING_MODES = [
  'automatic',
  'manual',
  'reminder',
] as const satisfies ReadonlyArray<RecurringTrackingMode>;

export const CURRENCIES = ['MXN', 'USD', 'EUR'] as const;

export interface ApiRecurringExpense {
  id: string;
  name: string;
  kind: RecurringKind;
  trackingMode: RecurringTrackingMode;
  frequency: RecurringFrequency;
  interval: number;
  startDate: string;
  endDate: string | null;
  amount: number;
  isVariableAmount: boolean;
  currency: string;
  accountId: string | null;
  categoryId: string | null;
  merchantPattern: string | null;
  installmentsTotal: number | null;
  installmentsPaid: number;
  active: boolean;
  notes: string | null;
  nextDueDate: string | null;
  monthlyCost: number;
}

export const RECURRING_EXPENSE_FIELDS =
  'id name kind trackingMode frequency interval startDate endDate amount isVariableAmount currency accountId categoryId merchantPattern installmentsTotal installmentsPaid active notes nextDueDate monthlyCost';

/** A due payment. Reminder-only expenses have no occurrence and no status. */
export interface ApiRecurringPayment {
  dueDate: string;
  expectedAmount: number;
  occurrenceId: string | null;
  status: OccurrenceStatus | null;
  recurringExpense: ApiRecurringExpense;
}

export const RECURRING_PAYMENT_FIELDS = `dueDate expectedAmount occurrenceId status recurringExpense { ${RECURRING_EXPENSE_FIELDS} }`;

export interface ApiRecurringCategory {
  id: string;
  name: string;
  parentId: string | null;
  key: string | null;
}

export interface ApiRecurringSuggestion {
  fingerprint: string;
  merchant: string;
  suggestedName: string;
  kind: RecurringKind;
  category: { id: string; name: string } | null;
  frequency: RecurringFrequency;
  interval: number;
  amount: number;
  isVariableAmount: boolean;
  currency: string;
  account: {
    id: string;
    name: string;
    metadata: { nickname?: string | null } | null;
  } | null;
  nextDueDate: string;
  occurrences: { transactionId: string; date: string; amount: number }[];
  confidence: number;
  classifiedBy: string | null;
}

export const RECURRING_SUGGESTION_FIELDS =
  'fingerprint merchant suggestedName kind category { id name } frequency interval amount isVariableAmount currency account { id name metadata { nickname } } nextDueDate occurrences { transactionId date amount } confidence classifiedBy';
