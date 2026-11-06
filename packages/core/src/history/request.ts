/**
 * The history's first-page request, shared by the web (server loader) and
 * the mobile app: the query, its variables and the screen's data.
 */
import { indexCategories } from '../finance/categories';
import { monthLabel, monthOf, type DayKey } from '../finance/dates';
import {
  ACCOUNT_FIELDS,
  CATEGORY_FIELDS,
  MONTHLY_REPORT_FIELDS,
  type ApiAccount,
  type ApiCategory,
  type ApiMonthlyReport,
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

export const HISTORY_QUERY = `query History($first: Int!, $after: String, $filters: TransactionFilters, $year: Int!, $month: Int!) {
  ${HISTORY_QUERY_FIELDS}
  accounts(first: 100) { edges { node { ${ACCOUNT_FIELDS} } } }
  categories(includeHidden: true) { ${CATEGORY_FIELDS} }
  monthlyReport(year: $year, month: $month) { ${MONTHLY_REPORT_FIELDS} }
  merchantAliases { id displayName }
}`;

export interface HistoryResult {
  transactions: Connection<ApiTransaction>;
  accounts: Connection<ApiAccount>;
  categories: ApiCategory[];
  monthlyReport: ApiMonthlyReport;
  merchantAliases: { id: string; displayName: string }[];
}

/** Top categories follow the month on screen (this one otherwise). */
function topMonth(filters: HistoryFilters, today: DayKey) {
  return shownMonth(filters) ?? monthOf(today);
}

export function historyVariables(filters: HistoryFilters, today: DayKey) {
  return {
    first: HISTORY_PAGE_SIZE,
    after: null,
    filters: toApiFilters(filters),
    ...topMonth(filters, today),
  };
}

/** First page of the filtered history plus what the filters and aside need. */
export function buildHistoryData(
  data: HistoryResult,
  filters: HistoryFilters,
  today: DayKey,
  l: Localizer,
): HistoryData {
  const { locale, t } = l;
  const month = topMonth(filters, today);
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
      title: t('history.topCategories', { month: monthLabel(month, locale) }),
      rows: topCategoryRows(data.monthlyReport, data.categories, l),
      chart: topCategoryChart(data.monthlyReport, data.categories, l),
    },
    aliasName: filters.aliasId
      ? (data.merchantAliases.find((a) => a.id === filters.aliasId)
          ?.displayName ?? null)
      : null,
  };
}
