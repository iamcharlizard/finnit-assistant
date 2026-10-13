import 'server-only';

import { serverGraphql } from '@/lib/api/server-graphql';
import { monthOf, todayKey, type MonthRef } from '@/lib/finance/dates';
import {
  CATEGORY_FIELDS,
  MONTHLY_REPORT_FIELDS,
  type ApiCategory,
  type ApiMonthlyReport,
} from '@/lib/finance/types';
import {
  buildAnalyticsView,
  trendMonths,
  type AnalyticsView,
  type ProjectionPoint,
} from './view';

const PROJECTION_MONTHS = 6;

/** Current month (Mexico City), the latest one analytics can show. */
export function currentMonth(): MonthRef {
  return monthOf(todayKey());
}

/** Six monthly reports, categories and the cash-flow projection in one request. */
export async function loadAnalytics(
  selected: MonthRef,
): Promise<AnalyticsView> {
  const months = trendMonths(selected);
  // Aliased reports, one per month; the numbers are validated MonthRefs.
  const reports = months
    .map(
      (m, i) =>
        `m${i}: monthlyReport(year: ${m.year}, month: ${m.month}) { ${MONTHLY_REPORT_FIELDS} }`,
    )
    .join('\n  ');
  const data = await serverGraphql<
    Record<string, ApiMonthlyReport> & {
      categories: ApiCategory[];
      cashFlowProjection: ProjectionPoint[];
      accounts: { totalCount: number };
    }
  >(
    `query Analytics($monthsAhead: Int!) {
  ${reports}
  categories { ${CATEGORY_FIELDS} }
  cashFlowProjection(monthsAhead: $monthsAhead) { date projectedBalance }
  accounts(first: 1, archived: false) { totalCount }
}`,
    { monthsAhead: PROJECTION_MONTHS },
  );

  return buildAnalyticsView(
    {
      reports: months.map((_, i) => data[`m${i}`] as ApiMonthlyReport),
      categories: data.categories,
      projection: data.cashFlowProjection,
      accountCount: data.accounts.totalCount,
    },
    { selected, current: currentMonth() },
  );
}
