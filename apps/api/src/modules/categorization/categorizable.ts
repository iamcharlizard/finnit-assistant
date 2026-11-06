import { Prisma, TransactionType } from '@finnit/database';

/** Movement types that take a category. */
export const CATEGORIZABLE_TYPES: TransactionType[] = [
  TransactionType.expense,
  TransactionType.income,
];

/**
 * Movements that can take a category: expenses and income that are not a
 * possible transfer waiting for the user's answer. Transfers and
 * adjustments never take one.
 */
export function categorizableWhere(): Prisma.TransactionWhereInput {
  return {
    type: { in: CATEGORIZABLE_TYPES },
    OR: [
      { transferSuggestion: { is: null } },
      { transferSuggestion: { status: { not: 'pending' } } },
    ],
  };
}
