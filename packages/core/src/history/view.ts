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
  DEFAULT_CURRENCY,
  formatMoney,
  percentOf,
  roundCents,
} from '../finance/money';
import {
  direction,
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
import { canConvertToTransfer, type ConvertSource } from '../transfers/convert';

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
  /** Unsigned amount. */
  value: number;
  /** "BBVA Débito" */
  accountLabel: string;
  /** Transfers: the transfer both sides share, and this side. */
  transferId: string | null;
  transferSide: 'in' | 'out' | null;
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
    value: amount,
    accountLabel: tx.account ? accountLabel(tx.account) : '',
    transferId: tx.type === 'transfer' ? (tx.transferId ?? null) : null,
    transferSide:
      tx.type === 'transfer'
        ? ((d) => (d === 'unknown' ? null : d))(direction(tx))
        : null,
  };
}

/**
 * Both sides of a transfer shown as one item: what moved, from which
 * account to which, and each side (opens its own detail).
 */
export interface TransferGroup {
  kind: 'transfer';
  key: string;
  title: string;
  /** "BBVA Débito → Nu" */
  route: string;
  /** Unsigned: "$1,000.00". */
  amount: string;
  /** Pending while either side is. */
  status: HistoryRow['status'];
  out: HistoryRow;
  in: HistoryRow;
  /** "Sale de BBVA Débito" / "Entra a Nu" */
  outLabel: string;
  inLabel: string;
}

export type HistoryItem = { kind: 'row'; row: HistoryRow } | TransferGroup;

/**
 * A day's rows with each transfer's two sides joined where the first one
 * was. A side whose pair isn't in the list (another account filtered, or
 * not loaded yet) stays a row of its own.
 */
export function groupTransfers(
  rows: ReadonlyArray<HistoryRow>,
  { locale, t }: Localizer,
): HistoryItem[] {
  const sides = new Map<string, { out?: HistoryRow; in?: HistoryRow }>();
  for (const row of rows) {
    if (!row.transferId || !row.transferSide) continue;
    const pair = sides.get(row.transferId) ?? {};
    if (!pair[row.transferSide]) pair[row.transferSide] = row;
    sides.set(row.transferId, pair);
  }
  const done = new Set<string>();
  const items: HistoryItem[] = [];
  for (const row of rows) {
    const pair = row.transferId ? sides.get(row.transferId) : undefined;
    if (!pair?.out || !pair.in || (pair.out !== row && pair.in !== row)) {
      items.push({ kind: 'row', row });
      continue;
    }
    if (done.has(row.transferId!)) continue;
    done.add(row.transferId!);
    const { out, in: inbound } = pair;
    items.push({
      kind: 'transfer',
      key: `transfer:${row.transferId}`,
      title: t('history.transfer.title'),
      route: `${out.accountLabel} → ${inbound.accountLabel}`,
      amount: formatMoney(out.value, out.currency, locale),
      status:
        out.status === 'pending' || inbound.status === 'pending'
          ? 'pending'
          : out.status === 'inProcess' || inbound.status === 'inProcess'
            ? 'inProcess'
            : 'completed',
      out,
      in: inbound,
      outLabel: t('history.transfer.from', { account: out.accountLabel }),
      inLabel: t('history.transfer.to', { account: inbound.accountLabel }),
    });
  }
  return items;
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

/** How many categories the top lists; the rest are "Otros" in the chart. */
export const TOP_CATEGORIES = 5;

export interface TopCategoryRow {
  id: string;
  label: string;
  /** "32%" */
  percentage: string;
  dotColor: string;
  /** Spent, and formatted. */
  value: number;
  amount: string;
}

/** Rows for PopularCategoriesCard: the month's top 5 spending categories. */
export function topCategoryRows(
  report: ApiMonthlyReport,
  categories: ReadonlyArray<ApiCategory>,
  { locale, t }: Localizer,
): TopCategoryRow[] {
  return spendingByCategory(report, indexCategories(categories), t)
    .slice(0, TOP_CATEGORIES)
    .map((c) => ({
      id: c.id,
      label: c.label,
      percentage: `${c.percent}%`,
      dotColor: c.color,
      value: c.amount,
      amount: formatMoney(c.amount, DEFAULT_CURRENCY, locale),
    }));
}

/** A slice of the month's spending (the top categories, then "Otros"). */
export interface CategorySlice extends TopCategoryRow {
  /** Share of the month's spending, 0–100. */
  percent: number;
  /** The remaining categories together. */
  others: boolean;
}

export interface CategoryChart {
  slices: CategorySlice[];
  /** The month's spending, formatted (the donut's center). */
  total: string;
}

/** The month's spending as a donut: the top categories and the rest together. */
export function topCategoryChart(
  report: ApiMonthlyReport,
  categories: ReadonlyArray<ApiCategory>,
  { locale, t }: Localizer,
): CategoryChart {
  const all = spendingByCategory(report, indexCategories(categories), t);
  const total = all.reduce((sum, c) => sum + c.amount, 0);
  const money = (n: number) => formatMoney(n, DEFAULT_CURRENCY, locale);
  const share = (n: number) => (total > 0 ? (n / total) * 100 : 0);
  const slices: CategorySlice[] = all.slice(0, TOP_CATEGORIES).map((c) => ({
    id: c.id,
    label: c.label,
    percentage: `${c.percent}%`,
    dotColor: c.color,
    value: c.amount,
    amount: money(c.amount),
    percent: share(c.amount),
    others: false,
  }));
  const rest = roundCents(
    all.slice(TOP_CATEGORIES).reduce((sum, c) => sum + c.amount, 0),
  );
  if (rest > 0) {
    slices.push({
      id: 'others',
      label: t('history.otherCategories'),
      percentage: `${percentOf(rest, report.totalExpenses)}%`,
      dotColor: 'var(--outline)',
      value: rest,
      amount: money(rest),
      percent: share(rest),
      others: true,
    });
  }
  return { slices, total: money(roundCents(total)) };
}
