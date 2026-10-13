import 'server-only';

import { serverGraphql } from '@/lib/api/server-graphql';
import { getLocalizer } from '@/lib/i18n/server';
import {
  monthOf,
  shiftMonth,
  todayKey,
  type MonthRef,
} from '@/lib/finance/dates';
import { DEFAULT_CURRENCY } from '@/lib/finance/money';
import {
  MONTHLY_REPORT_FIELDS,
  type ApiMonthlyReport,
} from '@/lib/finance/types';
import { SUGGESTION_MONTHS } from './suggestions';
import {
  BUDGET_CATEGORY_FIELDS,
  BUDGET_FIELDS,
  BUDGET_SUMMARY_FIELDS,
  type ApiBudget,
  type ApiBudgetSummary,
  type BudgetCategory,
} from './types';
import {
  budgetOf,
  buildBudgetCard,
  buildBudgetsView,
  type BudgetCardView,
  type BudgetsView,
} from './view';

/** Current month (Mexico City). */
export function currentMonth(): MonthRef {
  return monthOf(todayKey());
}

/** The selected month and the ones before it, newest first. */
const reportMonths = (selected: MonthRef) =>
  Array.from({ length: SUGGESTION_MONTHS + 1 }, (_, i) =>
    shiftMonth(selected, -i),
  );

/**
 * Budgets, categories and monthly reports (the month and the previous
 * ones, for suggestions) in one request; then, when the month has a budget,
 * its usage (budgetSummary fails for a month without one).
 */
export async function loadBudgets(selected: MonthRef): Promise<BudgetsView> {
  const months = reportMonths(selected);
  // Aliased reports, one per month; the numbers are validated MonthRefs.
  const reports = months
    .map(
      (m, i) =>
        `r${i}: monthlyReport(year: ${m.year}, month: ${m.month}) { ${MONTHLY_REPORT_FIELDS} }`,
    )
    .join('\n  ');
  const [data, l] = await Promise.all([
    serverGraphql<
      Record<string, ApiMonthlyReport> & {
        budgets: ApiBudget[];
        categories: BudgetCategory[];
      }
    >(`query Budgets {
  budgets { ${BUDGET_FIELDS} }
  categories { ${BUDGET_CATEGORY_FIELDS} }
  ${reports}
}`),
    getLocalizer(),
  ]);

  const summary = budgetOf(data.budgets, selected)
    ? (
        await serverGraphql<{ budgetSummary: ApiBudgetSummary }>(
          `query BudgetSummary($year: Float!, $month: Float!) { budgetSummary(year: $year, month: $month) { ${BUDGET_SUMMARY_FIELDS} } }`,
          { year: selected.year, month: selected.month },
        )
      ).budgetSummary
    : null;

  return buildBudgetsView(
    {
      budgets: data.budgets,
      categories: data.categories,
      summary,
      report: data.r0 as ApiMonthlyReport,
      previousReports: months
        .slice(1)
        .map((_, i) => data[`r${i + 1}`] as ApiMonthlyReport),
    },
    { selected, current: currentMonth(), currency: DEFAULT_CURRENCY },
    l,
  );
}

/**
 * The dashboard's budget card for the current month, or null without a
 * budget. Spending is the month's report total: the same confirmed
 * expenses budgetSummary adds up, without a second request.
 */
export async function loadBudgetCard(): Promise<BudgetCardView | null> {
  const month = currentMonth();
  const [data, l] = await Promise.all([
    serverGraphql<{ budgets: ApiBudget[]; monthlyReport: ApiMonthlyReport }>(
      `query DashboardBudget($year: Int!, $month: Int!) {
  budgets { ${BUDGET_FIELDS} }
  monthlyReport(year: $year, month: $month) { totalExpenses }
}`,
      { ...month },
    ),
    getLocalizer(),
  ]);
  const budget = budgetOf(data.budgets, month);
  return budget
    ? buildBudgetCard(budget, data.monthlyReport.totalExpenses, l)
    : null;
}
