import { indexCategories, rootCategory } from '@/lib/finance/categories';
import { roundCents } from '@/lib/finance/money';
import type { ApiMonthlyReport } from '@/lib/finance/types';
import type { BudgetCategory } from './types';

/**
 * Caps suggested for a month without a budget: the average monthly spending
 * of each top-level category over the previous months, rounded up.
 */
export interface CapSuggestion {
  categoryId: string;
  /** Average per month with spending, in cents. */
  average: number;
  /** The suggested cap: the average rounded up to a round number. */
  cap: number;
}

export const SUGGESTION_MONTHS = 3;
export const MAX_SUGGESTIONS = 8;

const INCOME_KEY = 'categories.income';

/** Up to the next 100 (the next 50 below 1,000), so caps read cleanly. */
export function roundCap(amount: number): number {
  const step = amount < 1000 ? 50 : 100;
  return Math.ceil(amount / step) * step;
}

/**
 * Suggestions from monthly reports: spending rolled up to its top-level
 * category (subcategories included), averaged over the months that had any
 * spending (a new user isn't averaged against empty months). Income and
 * unknown categories are left out; the biggest categories first.
 */
export function suggestCaps(
  reports: ReadonlyArray<ApiMonthlyReport>,
  categories: ReadonlyArray<BudgetCategory>,
): CapSuggestion[] {
  const index = indexCategories(categories);
  const months = reports.filter((r) => r.totalExpenses > 0).length;
  if (months === 0) return [];

  const totals = new Map<string, number>();
  for (const report of reports) {
    for (const line of report.categoryBreakdown) {
      const root = rootCategory(index, line.categoryId);
      if (!root) continue;
      if (categories.find((c) => c.id === root.id)?.key === INCOME_KEY) {
        continue;
      }
      totals.set(root.id, (totals.get(root.id) ?? 0) + line.amount);
    }
  }

  return [...totals.entries()]
    .map(([categoryId, total]) => {
      const average = roundCents(total / months);
      return { categoryId, average, cap: roundCap(average) };
    })
    .filter((s) => s.average > 0)
    .sort((a, b) => b.average - a.average)
    .slice(0, MAX_SUGGESTIONS);
}
