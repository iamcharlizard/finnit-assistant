import 'server-only';

import { serverGraphql } from '@/lib/api/server-graphql';
import {
  firstDayOf,
  lastDayOf,
  monthOf,
  startOfDayIso,
  endOfDayIso,
  todayKey,
} from '@finnit/core/finance/dates';
import { SETTINGS_CATEGORY_FIELDS, type SettingsCategory } from '@finnit/core/categories/types';

export interface CategoriesData {
  categories: SettingsCategory[];
  /** Movements per category this month. */
  usage: Record<string, number>;
}

const CATEGORIES_QUERY = `query SettingsCategories($from: DateTime, $to: DateTime) {
  categories(includeHidden: true) { ${SETTINGS_CATEGORY_FIELDS} }
  categoryUsage(dateFrom: $from, dateTo: $to) { categoryId transactionCount }
}`;

/** Every category the user sees (hidden ones too) and this month's use. */
export async function loadCategories(): Promise<CategoriesData> {
  const month = monthOf(todayKey());
  const data = await serverGraphql<{
    categories: SettingsCategory[];
    categoryUsage: { categoryId: string; transactionCount: number }[];
  }>(CATEGORIES_QUERY, {
    from: startOfDayIso(firstDayOf(month)),
    to: endOfDayIso(lastDayOf(month)),
  });
  return {
    categories: data.categories,
    usage: Object.fromEntries(
      data.categoryUsage.map((u) => [u.categoryId, u.transactionCount]),
    ),
  };
}
