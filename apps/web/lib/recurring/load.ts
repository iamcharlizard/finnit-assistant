import 'server-only';

import { serverGraphql } from '@/lib/api/server-graphql';
import { getLocalizer } from '@/lib/i18n/server';
import { endOfDayIso, startOfDayIso, todayKey } from '@/lib/finance/dates';
import {
  ACCOUNT_FIELDS,
  type ApiAccount,
  type Connection,
} from '@/lib/finance/types';
import { visibleRange, type RecurringView } from './range';
import {
  RECURRING_EXPENSE_FIELDS,
  RECURRING_PAYMENT_FIELDS,
  type ApiRecurringCategory,
  type ApiRecurringExpense,
  type ApiRecurringPayment,
} from './types';
import { buildRecurringView, type RecurringScreenView } from './view';

/** Far more than anyone has; the list isn't paginated on screen. */
const EXPENSES_PAGE = 200;

const RECURRING_QUERY = `query Recurring($from: DateTime!, $to: DateTime!, $first: Int!) {
  upcomingPayments(from: $from, to: $to) { ${RECURRING_PAYMENT_FIELDS} }
  active: recurringExpenses(first: $first, active: true) { edges { node { ${RECURRING_EXPENSE_FIELDS} } } }
  paused: recurringExpenses(first: $first, active: false) { edges { node { ${RECURRING_EXPENSE_FIELDS} } } }
  recurringExpensesSummary { totals { currency monthlyCost } }
  accounts(first: 100) { edges { node { ${ACCOUNT_FIELDS} } } }
  categories { id name parentId key }
}`;

/**
 * The visible period's payments, every recurring expense (active and
 * paused) and what the dialog's pickers need, in one request. Suggestions
 * load in the browser: they may take seconds the first time (AI).
 */
export async function loadRecurring({
  view,
  date,
}: {
  view: RecurringView;
  date: string;
}): Promise<RecurringScreenView> {
  const range = visibleRange(view, date);
  const [data, l] = await Promise.all([
    serverGraphql<{
      upcomingPayments: ApiRecurringPayment[];
      active: Connection<ApiRecurringExpense>;
      paused: Connection<ApiRecurringExpense>;
      recurringExpensesSummary: {
        totals: { currency: string; monthlyCost: number }[];
      };
      accounts: Connection<ApiAccount>;
      categories: ApiRecurringCategory[];
    }>(RECURRING_QUERY, {
      from: startOfDayIso(range.start),
      to: endOfDayIso(range.end),
      first: EXPENSES_PAGE,
    }),
    getLocalizer(),
  ]);

  return buildRecurringView(
    {
      payments: data.upcomingPayments,
      expenses: [...data.active.edges, ...data.paused.edges].map((e) => e.node),
      accounts: data.accounts.edges.map((e) => e.node),
      categories: data.categories,
      monthlyTotals: data.recurringExpensesSummary.totals,
    },
    { view, date, today: todayKey() },
    l,
  );
}
