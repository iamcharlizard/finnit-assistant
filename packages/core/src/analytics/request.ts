/**
 * The analytics screen's request (shared by the web loader and the mobile
 * app): six monthly reports, categories and the cash-flow projection.
 */
import type { MonthRef } from '../finance/dates';
import { CATEGORY_FIELDS, MONTHLY_REPORT_FIELDS, type ApiCategory, type ApiMonthlyReport } from '../finance/types';
import { trendMonths, type AnalyticsData, type ProjectionPoint } from './view';

export const PROJECTION_MONTHS = 6;

export type AnalyticsResult = Record<string, ApiMonthlyReport> & {
  categories: ApiCategory[];
  cashFlowProjection: ProjectionPoint[];
  accounts: { totalCount: number };
};

/** The query for the months shown (aliased reports; the numbers are validated MonthRefs). */
export function analyticsQuery(selected: MonthRef): string {
  const reports = trendMonths(selected)
    .map((m, i) => `m${i}: monthlyReport(year: ${m.year}, month: ${m.month}) { ${MONTHLY_REPORT_FIELDS} }`)
    .join('\n  ');
  return `query Analytics($monthsAhead: Int!) {
  ${reports}
  categories(includeHidden: true) { ${CATEGORY_FIELDS} }
  cashFlowProjection(monthsAhead: $monthsAhead) { date projectedBalance }
  accounts(first: 1, archived: false) { totalCount }
}`;
}

export function analyticsData(data: AnalyticsResult, selected: MonthRef): AnalyticsData {
  return {
    reports: trendMonths(selected).map((_, i) => data[`m${i}`] as ApiMonthlyReport),
    categories: data.categories,
    projection: data.cashFlowProjection,
    accountCount: data.accounts.totalCount,
  };
}
