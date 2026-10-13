import { indexCategories, rootCategory } from '@/lib/finance/categories';
import { categoryOptions, type PickerOption } from '@/lib/new-entry/options';
import type { BudgetCategory } from './types';

const INCOME_KEY = 'categories.income';

/**
 * Categories a cap can be set on: every expense category, top-level ones
 * and subcategories (a cap on a top-level category also counts its
 * subcategories), grouped under their parent. Income is left out.
 */
export function budgetCategoryOptions(
  categories: ReadonlyArray<BudgetCategory>,
  locale: string,
): PickerOption[] {
  const index = indexCategories(categories);
  const isIncome = (c: BudgetCategory) => {
    const root = rootCategory(index, c.id);
    return categories.find((r) => r.id === root?.id)?.key === INCOME_KEY;
  };
  return categoryOptions(
    categories.filter((c) => !isIncome(c)),
    'expense',
    locale,
  );
}
