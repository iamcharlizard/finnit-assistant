import 'server-only';

import { serverGraphql } from '@/lib/api/server-graphql';
import { getLocalizer } from '@/lib/i18n/server';
import {
  addDays,
  endOfDayIso,
  monthOf,
  startOfDayIso,
  todayKey,
} from '@finnit/core/finance/dates';
import { DEBT_INSIGHTS_FIELDS, type ApiDebtInsights } from '@finnit/core/debts/types';
import {
  ACCOUNT_FIELDS,
  MONTHLY_REPORT_FIELDS,
  UPCOMING_PAYMENT_FIELDS,
  type ApiAccount,
  type ApiMonthlyReport,
  type ApiUpcomingPayment,
  type Connection,
} from '@finnit/core/finance/types';
import { UPCOMING_DAYS, buildDashboardView, type DashboardView } from '@finnit/core/dashboard/view';

const DASHBOARD_QUERY = `query Dashboard($year: Int!, $month: Int!, $from: DateTime!, $to: DateTime!) {
  accounts(first: 100, archived: false) { edges { node { ${ACCOUNT_FIELDS} } } }
  monthlyReport(year: $year, month: $month) { ${MONTHLY_REPORT_FIELDS} }
  upcomingPayments(from: $from, to: $to) { ${UPCOMING_PAYMENT_FIELDS} }
  transactions(first: 1) { totalCount }
  debtInsights { ${DEBT_INSIGHTS_FIELDS} }
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
      transactions: { totalCount: number };
      debtInsights: ApiDebtInsights;
    }>(DASHBOARD_QUERY, {
      ...month,
      from: startOfDayIso(today),
      to: endOfDayIso(addDays(today, UPCOMING_DAYS)),
    }),
    getLocalizer(),
  ]);

  return buildDashboardView(
    {
      accounts: data.accounts.edges.map((e) => e.node),
      monthlyReport: data.monthlyReport,
      upcomingPayments: data.upcomingPayments,
      transactionCount: data.transactions.totalCount,
      debtInsights: data.debtInsights,
    },
    { today, month },
    l,
  );
}
