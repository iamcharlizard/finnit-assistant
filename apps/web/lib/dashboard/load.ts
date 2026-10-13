import 'server-only';

import { serverGraphql } from '@/lib/api/server-graphql';
import { getLocalizer } from '@/lib/i18n/server';
import {
  addDays,
  endOfDayIso,
  monthOf,
  startOfDayIso,
  todayKey,
} from '@/lib/finance/dates';
import {
  ACCOUNT_FIELDS,
  CATEGORY_FIELDS,
  MONTHLY_REPORT_FIELDS,
  TRANSACTION_FIELDS,
  UPCOMING_PAYMENT_FIELDS,
  type ApiAccount,
  type ApiCategory,
  type ApiMonthlyReport,
  type ApiTransaction,
  type ApiUpcomingPayment,
  type Connection,
} from '@/lib/finance/types';
import { UPCOMING_DAYS, buildDashboardView, type DashboardView } from './view';

const RECENT_COUNT = 8;

const DASHBOARD_QUERY = `query Dashboard($year: Int!, $month: Int!, $from: DateTime!, $to: DateTime!, $recent: Int!) {
  accounts(first: 100, archived: false) { edges { node { ${ACCOUNT_FIELDS} } } }
  monthlyReport(year: $year, month: $month) { ${MONTHLY_REPORT_FIELDS} }
  upcomingPayments(from: $from, to: $to) { ${UPCOMING_PAYMENT_FIELDS} }
  transactions(first: $recent) { totalCount edges { node { ${TRANSACTION_FIELDS} } } }
  categories { ${CATEGORY_FIELDS} }
}`;

/** Everything the dashboard shows, in one request. */
export async function loadDashboard(): Promise<DashboardView> {
  const today = todayKey();
  const month = monthOf(today);
  const [data, l] = await Promise.all([
    serverGraphql<{
      accounts: Connection<ApiAccount>;
      monthlyReport: ApiMonthlyReport;
      upcomingPayments: ApiUpcomingPayment[];
      transactions: Connection<ApiTransaction>;
      categories: ApiCategory[];
    }>(DASHBOARD_QUERY, {
      ...month,
      from: startOfDayIso(today),
      to: endOfDayIso(addDays(today, UPCOMING_DAYS)),
      recent: RECENT_COUNT,
    }),
    getLocalizer(),
  ]);

  return buildDashboardView(
    {
      accounts: data.accounts.edges.map((e) => e.node),
      monthlyReport: data.monthlyReport,
      upcomingPayments: data.upcomingPayments,
      transactions: data.transactions.edges.map((e) => e.node),
      transactionCount: data.transactions.totalCount,
      categories: data.categories,
    },
    { today, month },
    l,
  );
}
