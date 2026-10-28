import type { Translate } from '@/lib/i18n/translator';

import {
  ICON_COLORS,
  categoryLabel,
  iconKeyForName,
  rootCategory,
  type CategoryIndex,
  type IconKey,
} from './categories';
import { percentOf, roundCents } from './money';
import type { ApiMonthlyReport } from './types';

export interface CategorySpending {
  /** Top-level category id, or "uncategorized". */
  id: string;
  label: string;
  amount: number;
  /** Share of the month's expenses, 0–100. */
  percent: number;
  iconKey: IconKey;
  color: string;
}

/**
 * The month's expenses by top-level category, largest first. Subcategories
 * add up into their parent; expenses without a category (which the report
 * leaves out of its breakdown) become "Sin categoría" ("uncategorized").
 */
export function spendingByCategory(
  report: Pick<ApiMonthlyReport, 'totalExpenses' | 'categoryBreakdown'>,
  categories: CategoryIndex,
  t: Translate,
): CategorySpending[] {
  const totals = new Map<string, { name: string; amount: number }>();
  for (const item of report.categoryBreakdown) {
    const root = rootCategory(categories, item.categoryId);
    const id = root?.id ?? item.categoryId;
    const current = totals.get(id) ?? {
      name: root?.name ?? item.categoryName,
      amount: 0,
    };
    current.amount = roundCents(current.amount + item.amount);
    totals.set(id, current);
  }

  const categorized = [...totals.values()].reduce(
    (sum, total) => sum + total.amount,
    0,
  );
  const uncategorized = roundCents(report.totalExpenses - categorized);
  if (uncategorized > 0) {
    totals.set('uncategorized', { name: '', amount: uncategorized });
  }

  return [...totals.entries()]
    .filter(([, total]) => total.amount > 0)
    .map(([id, total]) => {
      const iconKey = iconKeyForName(total.name);
      return {
        id,
        label: categoryLabel(total.name, t),
        amount: total.amount,
        percent: percentOf(total.amount, report.totalExpenses),
        iconKey,
        color: ICON_COLORS[iconKey],
      };
    })
    .sort((a, b) => b.amount - a.amount);
}
