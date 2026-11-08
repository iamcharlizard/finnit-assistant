/**
 * The history's first-page request, shared by the web (server loader) and
 * the mobile app: the query, its variables and the screen's data.
 */
import { indexCategories } from '../finance/categories';
import { monthLabel, shortDate, type DayKey } from '../finance/dates';
import {
  ACCOUNT_FIELDS,
  CATEGORY_FIELDS,
  type ApiAccount,
  type ApiCategory,
  type ApiTransaction,
  type Connection,
} from '../finance/types';
import type { Localizer } from '../i18n/translator';
import {
  HISTORY_PAGE_SIZE,
  shownMonth,
  toApiFilters,
  type HistoryFilters,
} from './filters';
import {
  HISTORY_QUERY_FIELDS,
  accountOptions,
  categoryOptions,
  toTransactionPage,
  topCategoryChart,
  topCategoryRows,
  type CategoryChart,
  type Option,
  type SpendingReport,
  type TransactionPage,
} from './view';

export interface HistoryData {
  today: DayKey;
  page: TransactionPage;
  categories: ApiCategory[];
  accounts: Option[];
  categoryOptions: Option[];
  topCategories: {
    title: string;
    rows: ReturnType<typeof topCategoryRows>;
    chart: CategoryChart;
  };
  /** Name of the automatic name the list is filtered by. */
  aliasName: string | null;
}

/** The spending by category of the filtered movements (the top and its chart). */
export const SPENDING_FIELDS =
  'transactionSpending(filters: $filters) { totalExpenses categoryBreakdown { categoryId categoryName amount } }';

export const HISTORY_QUERY = `query History($first: Int!, $after: String, $filters: TransactionFilters) {
  ${HISTORY_QUERY_FIELDS}
  accounts(first: 100) { edges { node { ${ACCOUNT_FIELDS} } } }
  categories(includeHidden: true) { ${CATEGORY_FIELDS} }
  ${SPENDING_FIELDS}
  merchantAliases { id displayName }
}`;

export interface HistoryResult {
  transactions: Connection<ApiTransaction>;
  accounts: Connection<ApiAccount>;
  categories: ApiCategory[];
  transactionSpending: SpendingReport;
  merchantAliases: { id: string; displayName: string }[];
}

/** The period the top covers: the month, the range or the whole history. */
export function spendingPeriodLabel(
  filters: HistoryFilters,
  { locale, t }: Localizer,
): string {
  const month = shownMonth(filters);
  if (month) return monthLabel(month, locale);
  if (filters.from || filters.to) {
    return t('history.rangeLabel', {
      from: filters.from ? shortDate(filters.from, locale) : '…',
      to: filters.to ? shortDate(filters.to, locale) : '…',
    });
  }
  return t('history.allTime');
}

export function historyVariables(filters: HistoryFilters) {
  return {
    first: HISTORY_PAGE_SIZE,
    after: null,
    filters: toApiFilters(filters),
  };
}

/** First page of the filtered history plus what the filters and aside need. */
export function buildHistoryData(
  data: HistoryResult,
  filters: HistoryFilters,
  today: DayKey,
  l: Localizer,
): HistoryData {
  const { t } = l;
  const chart = topCategoryChart(
    data.transactionSpending,
    data.categories,
    l,
  );
  return {
    today,
    page: toTransactionPage(
      data.transactions,
      indexCategories(data.categories),
      l,
    ),
    categories: data.categories,
    accounts: accountOptions(
      data.accounts.edges.map((e) => e.node),
      t,
    ),
    categoryOptions: categoryOptions(data.categories, t),
    topCategories: {
      title: t('history.topCategories', {
        month: spendingPeriodLabel(filters, l),
      }),
      rows: topCategoryRows(chart),
      chart,
    },
    aliasName: filters.aliasId
      ? (data.merchantAliases.find((a) => a.id === filters.aliasId)
          ?.displayName ?? null)
      : null,
  };
}
