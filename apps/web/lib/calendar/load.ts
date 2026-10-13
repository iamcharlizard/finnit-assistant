import 'server-only';

import { serverGraphql } from '@/lib/api/server-graphql';
import { getLocalizer } from '@/lib/i18n/server';
import {
  endOfDayIso,
  firstDayOf,
  lastDayOf,
  startOfDayIso,
  todayKey,
  type MonthRef,
} from '@/lib/finance/dates';
import {
  ACCOUNT_FIELDS,
  UPCOMING_PAYMENT_FIELDS,
  type ApiAccount,
  type ApiUpcomingPayment,
  type Connection,
} from '@/lib/finance/types';
import { buildCalendarView, type CalendarView } from './view';

const CALENDAR_QUERY = `query Calendar($from: DateTime!, $to: DateTime!) {
  upcomingPayments(from: $from, to: $to) { ${UPCOMING_PAYMENT_FIELDS} }
  accounts(first: 100, archived: false) { edges { node { ${ACCOUNT_FIELDS} } } }
  recurringExpensesSummary { totals { currency monthlyCost } }
  recurringExpenses(first: 1) { totalCount }
}`;

/** A month's recurring payments and card dates, in one request. */
export async function loadCalendar(month: MonthRef): Promise<CalendarView> {
  const [data, l] = await Promise.all([
    serverGraphql<{
      upcomingPayments: ApiUpcomingPayment[];
      accounts: Connection<ApiAccount>;
      recurringExpensesSummary: {
        totals: { currency: string; monthlyCost: number }[];
      };
      recurringExpenses: { totalCount: number };
    }>(CALENDAR_QUERY, {
      from: startOfDayIso(firstDayOf(month)),
      to: endOfDayIso(lastDayOf(month)),
    }),
    getLocalizer(),
  ]);

  return buildCalendarView(
    {
      payments: data.upcomingPayments,
      accounts: data.accounts.edges.map((e) => e.node),
      recurringTotals: data.recurringExpensesSummary.totals,
      recurringCount: data.recurringExpenses.totalCount,
    },
    { month, today: todayKey() },
    l,
  );
}
