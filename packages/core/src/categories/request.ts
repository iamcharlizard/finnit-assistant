/** The categories settings request, shared by the web loader and the mobile app. */
import { endOfDayIso, firstDayOf, lastDayOf, monthOf, startOfDayIso, type DayKey } from '../finance/dates';
import { SETTINGS_CATEGORY_FIELDS, type SettingsCategory } from './types';

export interface CategoriesData {
  categories: SettingsCategory[];
  /** Movements per category this month. */
  usage: Record<string, number>;
}

export const CATEGORIES_QUERY = `query SettingsCategories($from: DateTime, $to: DateTime) {
  categories(includeHidden: true) { ${SETTINGS_CATEGORY_FIELDS} }
  categoryUsage(dateFrom: $from, dateTo: $to) { categoryId transactionCount }
}`;

export interface CategoriesResult {
  categories: SettingsCategory[];
  categoryUsage: { categoryId: string; transactionCount: number }[];
}

export function categoriesVariables(today: DayKey) {
  const month = monthOf(today);
  return { from: startOfDayIso(firstDayOf(month)), to: endOfDayIso(lastDayOf(month)) };
}

export function categoriesData(data: CategoriesResult): CategoriesData {
  return {
    categories: data.categories,
    usage: Object.fromEntries(data.categoryUsage.map((u) => [u.categoryId, u.transactionCount])),
  };
}
