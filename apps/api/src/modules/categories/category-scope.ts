import type { Prisma } from '@finnit/database';

/**
 * The categories a user can use: the global catalog (userId null,
 * isDefault) and their own. Hidden catalog entries are included: movements
 * that already have them keep showing them and can still be assigned one.
 */
export function visibleCategoryWhere(
  userId: string,
): Prisma.CategoryWhereInput {
  return { OR: [{ userId }, { userId: null, isDefault: true }] };
}

/** What the pickers offer: the visible categories minus the ones the user hid. */
export function pickableCategoryWhere(
  userId: string,
): Prisma.CategoryWhereInput {
  return {
    AND: [visibleCategoryWhere(userId), { hiddenBy: { none: { userId } } }],
  };
}

/**
 * Movements that count in income/expense totals, reports and charts: the
 * ones without a category or whose category the user didn't leave out
 * ("no cuenta en sumas"). Put it in an `AND`, it carries its own `OR`.
 */
export function countedInTotalsWhere(): Prisma.TransactionWhereInput {
  return {
    OR: [
      { categoryId: null },
      { category: { is: { excludeFromTotals: false } } },
    ],
  };
}
