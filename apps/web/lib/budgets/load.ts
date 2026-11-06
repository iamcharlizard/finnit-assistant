import 'server-only';

import { serverGraphql } from '@/lib/api/server-graphql';
import { getLocalizer } from '@/lib/i18n/server';
import { monthOf, todayKey, type MonthRef } from '@finnit/core/finance/dates';
import { DEFAULT_CURRENCY } from '@finnit/core/finance/money';
import {
  BUDGET_SUMMARY_QUERY,
  budgetsData,
  budgetsQuery,
  type BudgetsResult,
} from '@finnit/core/budgets/request';
import {
  DASHBOARD_BUDGET_QUERY,
  type DashboardBudgetResult,
} from '@finnit/core/dashboard/request';
import type { ApiBudgetSummary } from '@finnit/core/budgets/types';
import {
  budgetOf,
  buildBudgetCard,
  buildBudgetsView,
  type BudgetCardView,
  type BudgetsView,
} from '@finnit/core/budgets/view';

/** Current month (Mexico City). */
export function currentMonth(): MonthRef {
  return monthOf(todayKey());
}

/**
 * Budgets, categories and monthly reports (the month and the previous
 * ones, for suggestions) in one request; then, when the month has a budget,
 * its usage (budgetSummary fails for a month without one).
 */
export async function loadBudgets(selected: MonthRef): Promise<BudgetsView> {
  const [data, l] = await Promise.all([
    serverGraphql<BudgetsResult>(budgetsQuery(selected)),
    getLocalizer(),
  ]);
  const summary = budgetOf(data.budgets, selected)
    ? (
        await serverGraphql<{ budgetSummary: ApiBudgetSummary }>(
          BUDGET_SUMMARY_QUERY,
          { year: selected.year, month: selected.month },
        )
      ).budgetSummary
    : null;
  return buildBudgetsView(
    budgetsData(data, selected, summary),
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
    serverGraphql<DashboardBudgetResult>(DASHBOARD_BUDGET_QUERY, { ...month }),
    getLocalizer(),
  ]);
  const budget = budgetOf(data.budgets, month);
  return budget
    ? buildBudgetCard(budget, data.monthlyReport.totalExpenses, l)
    : null;
}
