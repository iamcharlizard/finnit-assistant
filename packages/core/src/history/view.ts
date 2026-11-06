import { nameSubjectOf, type NameSubject } from '../categorize/rename';
import type { Localizer, Translate } from '../i18n/translator';
import { accountLabel } from '../finance/accounts';
import { spendingByCategory } from '../finance/breakdown';
import {
  categoryLabel,
  indexCategories,
  type CategoryIndex,
} from '../finance/categories';
import {
  toTransactionRow,
  type TransactionRow,
} from '../finance/transactions';
import {
  TRANSACTION_FIELDS,
  type ApiAccount,
  type ApiCategory,
  type ApiMonthlyReport,
  type ApiTransaction,
  type Connection,
} from '../finance/types';
import {
  canConvertToTransfer,
  type ConvertSource,
} from '../transfers/convert';

export const HISTORY_QUERY_FIELDS = `transactions(first: $first, after: $after, filters: $filters) {
    totalCount
    edges { node { ${TRANSACTION_FIELDS} } }
    pageInfo { endCursor hasNextPage }
  }`;

/** One page of transactions (the client asks for the next ones with it). */
export const TRANSACTIONS_PAGE_QUERY = `query TransactionsPage($first: Int!, $after: String, $filters: TransactionFilters) {
  ${HISTORY_QUERY_FIELDS}
}`;

/** A history row plus what its "⋯" menu needs. */
export interface HistoryRow extends TransactionRow {
  /** What the name editor ("Editar nombre") starts from. */
  name: NameSubject;
  /** "Convertir en transferencia"; null for transfers and adjustments. */
  convert: ConvertSource | null;
  /** Signed amount for the day's net: transfers and adjustments are 0. */
  net: number;
  currency: string;
}

export function toHistoryRow(
  tx: ApiTransaction,
  categories: CategoryIndex,
  l: Localizer,
): HistoryRow {
  const row = toTransactionRow(tx, categories, l);
  const amount = Math.abs(tx.amount);
  return {
    ...row,
    name: nameSubjectOf(tx),
    convert: canConvertToTransfer(tx)
      ? {
          id: tx.id,
          type: tx.type,
          accountId: tx.accountId,
          currency: tx.currency,
          amount,
        }
      : null,
    net: tx.isPending
      ? 0
      : tx.type === 'income'
        ? amount
        : tx.type === 'expense'
          ? -amount
          : 0,
    currency: tx.currency,
  };
}

/** The day's income minus spending, when its rows share one currency. */
export function dayNet(
  rows: ReadonlyArray<Pick<HistoryRow, 'net' | 'currency'>>,
): { amount: number; currency: string } | null {
  const currencies = new Set(rows.map((row) => row.currency));
  if (currencies.size !== 1) return null;
  const amount =
    Math.round(rows.reduce((sum, row) => sum + row.net, 0) * 100) / 100;
  return { amount, currency: rows[0]!.currency };
}

export interface TransactionPage {
  rows: HistoryRow[];
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
    rows: connection.edges.map((e) => toHistoryRow(e.node, categories, l)),
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
    label: `${accountLabel(a)} · ${t(`finance.accountTypes.${a.type}`)}`,
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
