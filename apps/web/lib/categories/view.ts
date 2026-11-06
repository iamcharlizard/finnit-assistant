import {
  categoryIconKey,
  indexCategories,
  type IconKey,
} from '@/lib/finance/categories';
import type { CategoryKind, SettingsCategory } from './types';

/** A category row of the settings screen. */
export interface CategoryRow {
  id: string;
  name: string;
  kind: CategoryKind;
  iconKey: IconKey;
  /** The icon stored on it (null: picked by name). */
  icon: string | null;
  parentId: string | null;
  isDefault: boolean;
  hidden: boolean;
  editable: boolean;
  /** Movements this month. */
  count: number;
}

export interface CategoryGroup extends CategoryRow {
  children: CategoryRow[];
}

/**
 * Main categories of a kind with their subcategories: the catalog in its
 * curated order first, then the user's own by name (subcategories too).
 */
export function categoryTree(
  categories: ReadonlyArray<SettingsCategory>,
  kind: CategoryKind,
  usage: Readonly<Record<string, number>>,
  locale: string,
): CategoryGroup[] {
  const index = indexCategories(categories);
  const ids = new Set(categories.map((c) => c.id));
  const order = (a: SettingsCategory, b: SettingsCategory) =>
    Number(b.isDefault) - Number(a.isDefault) ||
    (a.isDefault && b.isDefault
      ? (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
      : 0) ||
    a.name.localeCompare(b.name, locale);
  const row = (c: SettingsCategory): CategoryRow => ({
    id: c.id,
    name: c.name,
    kind: c.kind,
    iconKey: categoryIconKey(index, c.id),
    icon: c.icon,
    parentId: c.parentId,
    isDefault: c.isDefault,
    hidden: c.hidden,
    editable: c.editable,
    count: usage[c.id] ?? 0,
  });

  return categories
    .filter((c) => c.kind === kind && (!c.parentId || !ids.has(c.parentId)))
    .sort(order)
    .map((root) => ({
      ...row(root),
      children: categories
        .filter((c) => c.parentId === root.id)
        .sort(order)
        .map(row),
    }));
}

/** Main categories a new subcategory can hang from, by kind. */
export function parentOptions(
  categories: ReadonlyArray<SettingsCategory>,
  kind: CategoryKind,
  excludeId?: string,
): SettingsCategory[] {
  return categories.filter(
    (c) => !c.parentId && c.kind === kind && c.id !== excludeId && !c.hidden,
  );
}

/**
 * Where a deleted category's movements can go: any other category of the
 * same kind that isn't the category itself or one of its subcategories.
 */
export function moveTargets(
  categories: ReadonlyArray<SettingsCategory>,
  category: Pick<SettingsCategory, 'id' | 'kind'>,
): SettingsCategory[] {
  return categories.filter(
    (c) =>
      c.kind === category.kind &&
      c.id !== category.id &&
      c.parentId !== category.id &&
      !c.hidden,
  );
}

/** Whatever deleting would move: movements, budgets, rules… */
export interface CategoryReferences {
  transactions: number;
  children: number;
  budgetCaps: number;
  rules: number;
  aliases: number;
  recurring: number;
}

export function isInUse(refs: CategoryReferences): boolean {
  return Object.values(refs).some((n) => n > 0);
}
