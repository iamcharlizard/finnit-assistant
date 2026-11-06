import 'server-only';

import { serverGraphql } from '@/lib/api/server-graphql';
import {
  CATEGORIES_QUERY,
  categoriesData,
  categoriesVariables,
  type CategoriesData,
  type CategoriesResult,
} from '@finnit/core/categories/request';
import { todayKey } from '@finnit/core/finance/dates';

export type { CategoriesData };

/** Every category the user sees (hidden ones too) and this month's use. */
export async function loadCategories(): Promise<CategoriesData> {
  const data = await serverGraphql<CategoriesResult>(
    CATEGORIES_QUERY,
    categoriesVariables(todayKey()),
  );
  return categoriesData(data);
}
