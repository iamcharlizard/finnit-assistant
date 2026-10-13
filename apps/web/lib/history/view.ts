import type { Localizer, Translate } from '@/lib/i18n/translator';
import { spendingByCategory } from '@/lib/finance/breakdown';
import {
  categoryLabel,
  indexCategories,
  type CategoryIndex,
} from '@/lib/finance/categories';
import {
  toTransactionRow,
  type TransactionRow,
} from '@/lib/finance/transactions';
import {
  TRANSACTION_FIELDS,
  type ApiAccount,
  type ApiCategory,
  type ApiMonthlyReport,
  type ApiTransaction,
  type Connection,
} from '@/lib/finance/types';

export const HISTORY_QUERY_FIELDS = `transactions(first: $first, after: $after, filters: $filters) {
    totalCount
    edges { node { ${TRANSACTION_FIELDS} } }
    pageInfo { endCursor hasNextPage }
  }`;

/** One page of transactions (the client asks for the next ones with it). */
export const TRANSACTIONS_PAGE_QUERY = `query TransactionsPage($first: Int!, $after: String, $filters: TransactionFilters) {
  ${HISTORY_QUERY_FIELDS}
}`;

export interface TransactionPage {
  rows: TransactionRow[];
  totalCount: number;
  endCursor: string | null;
  hasNextPage: boolean;
}

export function toTransactionPage(
  connection: Connection<ApiTransaction>,
  categories: CategoryIndex,
  l: Localizer,
): TransactionPage {
  return {
    rows: connection.edges.map((e) => toTransactionRow(e.node, categories, l)),
    totalCount: connection.totalCount,
    endCursor: connection.pageInfo.endCursor,
    hasNextPage: connection.pageInfo.hasNextPage,
  };
}

export interface Option {
  value: string;
  label: string;
}

export function accountOptions(
  accounts: ReadonlyArray<ApiAccount>,
  t: Translate,
): Option[] {
  return accounts.map((a) => ({
    value: a.id,
    label: `${a.name} · ${t(`finance.accountTypes.${a.type}`)}`,
  }));
}

/** Top-level categories, each followed by its subcategories ("Comida › Café"). */
export function categoryOptions(
  categories: ReadonlyArray<ApiCategory>,
  t: Translate,
): Option[] {
  const roots = categories.filter((c) => !c.parentId);
  return roots.flatMap((root) => [
    { value: root.id, label: categoryLabel(root.name, t) },
    ...categories
      .filter((c) => c.parentId === root.id)
      .map((c) => ({
        value: c.id,
        label: `${categoryLabel(root.name, t)} › ${categoryLabel(c.name, t)}`,
      })),
  ]);
}

/** Rows for PopularCategoriesCard: the month's top 5 spending categories. */
export function topCategoryRows(
  report: ApiMonthlyReport,
  categories: ReadonlyArray<ApiCategory>,
  t: Translate,
): { id: string; label: string; percentage: string; dotColor: string }[] {
  return spendingByCategory(report, indexCategories(categories), t)
    .slice(0, 5)
    .map((c) => ({
      id: c.id,
      label: c.label,
      percentage: `${c.percent}%`,
      dotColor: c.color,
    }));
}
