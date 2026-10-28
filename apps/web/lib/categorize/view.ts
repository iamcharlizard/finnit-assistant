import type { CategoryIndex } from '@/lib/finance/categories';
import { categoryLabel } from '@/lib/finance/categories';
import {
  toTransactionRow,
  type TransactionRow,
} from '@/lib/finance/transactions';
import type { CategorySource } from '@/lib/finance/types';
import type { Localizer } from '@/lib/i18n/translator';
import type { CategorizeTransaction } from './types';

/** A row of "Clasificar movimientos", ready to render. */
export interface CategorizeRow extends TransactionRow {
  /** Income and expenses take a category; transfers and adjustments don't. */
  selectable: boolean;
  categoryId: string | null;
  categorySource: CategorySource | null;
  /** The AI's pending suggestion. */
  suggestion: { categoryId: string; label: string } | null;
  /** What the rename dialog starts from. */
  displayName: string;
  hasOwnAlias: boolean;
  /** The bank's text, when the API sends it (not for private rows). */
  original: string | null;
}

export function isCategorizable(tx: Pick<CategorizeTransaction, 'type'>) {
  return tx.type === 'income' || tx.type === 'expense';
}

export function toCategorizeRow(
  tx: CategorizeTransaction,
  categories: CategoryIndex,
  l: Localizer,
): CategorizeRow {
  const suggested = tx.suggestedCategory;
  const original =
    tx.originalDescription ??
    (tx.isPrivate ? null : (tx.merchantName ?? tx.description ?? null));
  return {
    ...toTransactionRow(tx, categories, l),
    selectable: isCategorizable(tx),
    categoryId: tx.category?.id ?? null,
    categorySource: tx.categorySource ?? null,
    suggestion: suggested
      ? {
          categoryId: suggested.id,
          label: categoryLabel(
            categories.get(suggested.id)?.name ?? suggested.name,
            l.t,
          ),
        }
      : null,
    displayName: tx.displayName ?? '',
    hasOwnAlias: Boolean(tx.hasOwnAlias),
    original: original?.trim() || null,
  };
}

/**
 * Puts updated transactions (from a suggestion or a reload) in place of the
 * old ones, keeping the list's order. Unknown ones are ignored.
 */
export function mergeTransactions(
  current: ReadonlyArray<CategorizeTransaction>,
  updates: ReadonlyArray<CategorizeTransaction>,
): CategorizeTransaction[] {
  const byId = new Map(updates.map((tx) => [tx.id, tx]));
  return current.map((tx) => byId.get(tx.id) ?? tx);
}

/** Appends a page, never showing a row twice. */
export function appendPage(
  current: ReadonlyArray<CategorizeTransaction>,
  next: ReadonlyArray<CategorizeTransaction>,
): CategorizeTransaction[] {
  const seen = new Set(current.map((tx) => tx.id));
  return [...current, ...next.filter((tx) => !seen.has(tx.id))];
}
