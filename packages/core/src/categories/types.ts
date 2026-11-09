/** A category as the settings screen gets it from the API. */
export interface SettingsCategory {
  id: string;
  name: string;
  parentId: string | null;
  key: string | null;
  kind: CategoryKind;
  icon: string | null;
  sortOrder: number | null;
  /** Catalog category (shared, read-only). */
  isDefault: boolean;
  hidden: boolean;
  editable: boolean;
  /** Left out of income/expense totals, reports and charts. */
  excludeFromTotals: boolean;
}

export type CategoryKind = 'expense' | 'income';

export const SETTINGS_CATEGORY_FIELDS =
  'id name parentId key kind icon sortOrder isDefault hidden editable excludeFromTotals';

export const CATEGORY_KINDS: ReadonlyArray<CategoryKind> = [
  'expense',
  'income',
];

/** Names longer than this are refused by the API. */
export const CATEGORY_NAME_MAX = 60;
