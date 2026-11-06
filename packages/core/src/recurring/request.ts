/**
 * The recurring payments screen's request, shared by the web loader and
 * the mobile app.
 */
import { endOfDayIso, startOfDayIso } from '../finance/dates';
import { ACCOUNT_FIELDS, type ApiAccount, type Connection } from '../finance/types';
import { visibleRange, type RecurringView } from './range';
import {
  RECURRING_EXPENSE_FIELDS,
  RECURRING_PAYMENT_FIELDS,
  type ApiRecurringCategory,
  type ApiRecurringExpense,
  type ApiRecurringPayment,
} from './types';
import type { RecurringData } from './view';

/** Far more than anyone has; the list isn't paginated on screen. */
export const EXPENSES_PAGE = 200;

export const RECURRING_QUERY = `query Recurring($from: DateTime!, $to: DateTime!, $first: Int!) {
  upcomingPayments(from: $from, to: $to) { ${RECURRING_PAYMENT_FIELDS} }
  active: recurringExpenses(first: $first, active: true) { edges { node { ${RECURRING_EXPENSE_FIELDS} } } }
  paused: recurringExpenses(first: $first, active: false) { edges { node { ${RECURRING_EXPENSE_FIELDS} } } }
  recurringExpensesSummary { totals { currency monthlyCost } }
  accounts(first: 100) { edges { node { ${ACCOUNT_FIELDS} } } }
  categories { id name parentId key kind icon }
}`;

export interface RecurringResult {
  upcomingPayments: ApiRecurringPayment[];
  active: Connection<ApiRecurringExpense>;
  paused: Connection<ApiRecurringExpense>;
  recurringExpensesSummary: { totals: { currency: string; monthlyCost: number }[] };
  accounts: Connection<ApiAccount>;
  categories: ApiRecurringCategory[];
}

export function recurringVariables(view: RecurringView, date: string) {
  const range = visibleRange(view, date);
  return { from: startOfDayIso(range.start), to: endOfDayIso(range.end), first: EXPENSES_PAGE };
}

export function recurringData(data: RecurringResult): RecurringData {
  return {
    payments: data.upcomingPayments,
    expenses: [...data.active.edges, ...data.paused.edges].map((e) => e.node),
    accounts: data.accounts.edges.map((e) => e.node),
    categories: data.categories,
    monthlyTotals: data.recurringExpensesSummary.totals,
  };
}
