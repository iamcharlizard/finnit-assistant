/**
 * The budgets screen's requests, shared by the web loader and the mobile
 * app.
 */
import { shiftMonth, type MonthRef } from '../finance/dates';
import { MONTHLY_REPORT_FIELDS, type ApiMonthlyReport } from '../finance/types';
import { SUGGESTION_MONTHS } from './suggestions';
import {
  BUDGET_CATEGORY_FIELDS,
  BUDGET_FIELDS,
  BUDGET_SUMMARY_FIELDS,
  type ApiBudget,
  type ApiBudgetSummary,
  type BudgetCategory,
} from './types';
import type { BudgetsData } from './view';

/** The selected month and the ones before it, newest first. */
export const reportMonths = (selected: MonthRef) =>
  Array.from({ length: SUGGESTION_MONTHS + 1 }, (_, i) => shiftMonth(selected, -i));

export type BudgetsResult = Record<string, ApiMonthlyReport> & {
  budgets: ApiBudget[];
  categories: BudgetCategory[];
};

/** Budgets, categories and the month's and previous months' reports (aliased; validated MonthRefs). */
export function budgetsQuery(selected: MonthRef): string {
  const reports = reportMonths(selected)
    .map((m, i) => `r${i}: monthlyReport(year: ${m.year}, month: ${m.month}) { ${MONTHLY_REPORT_FIELDS} }`)
    .join('\n  ');
  return `query Budgets {
  budgets { ${BUDGET_FIELDS} }
  categories(includeHidden: true) { ${BUDGET_CATEGORY_FIELDS} }
  ${reports}
}`;
}

/** The month's usage; only for a month that has a budget. */
export const BUDGET_SUMMARY_QUERY = `query BudgetSummary($year: Float!, $month: Float!) { budgetSummary(year: $year, month: $month) { ${BUDGET_SUMMARY_FIELDS} } }`;

export function budgetsData(
  data: BudgetsResult,
  selected: MonthRef,
  summary: ApiBudgetSummary | null,
): BudgetsData {
  return {
    budgets: data.budgets,
    categories: data.categories,
    summary,
    report: data.r0 as ApiMonthlyReport,
    previousReports: reportMonths(selected)
      .slice(1)
      .map((_, i) => data[`r${i + 1}`] as ApiMonthlyReport),
  };
}
