import 'server-only';

import { serverGraphql } from '@/lib/api/server-graphql';
import { getLocalizer } from '@/lib/i18n/server';
import { indexCategories } from '@/lib/finance/categories';
import {
  monthLabel,
  monthOf,
  todayKey,
  type DayKey,
} from '@/lib/finance/dates';
import {
  ACCOUNT_FIELDS,
  CATEGORY_FIELDS,
  MONTHLY_REPORT_FIELDS,
  type ApiAccount,
  type ApiCategory,
  type ApiMonthlyReport,
  type ApiTransaction,
  type Connection,
} from '@/lib/finance/types';
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
  topCategoryRows,
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
  };
  /** Name of the automatic name the list is filtered by. */
  aliasName: string | null;
}

const HISTORY_QUERY = `query History($first: Int!, $after: String, $filters: TransactionFilters, $year: Int!, $month: Int!) {
  ${HISTORY_QUERY_FIELDS}
  accounts(first: 100) { edges { node { ${ACCOUNT_FIELDS} } } }
  categories(includeHidden: true) { ${CATEGORY_FIELDS} }
  monthlyReport(year: $year, month: $month) { ${MONTHLY_REPORT_FIELDS} }
  merchantAliases { id displayName }
}`;

/** First page of the filtered history plus what the filters and aside need. */
export async function loadHistory(
  filters: HistoryFilters,
): Promise<HistoryData> {
  const today = todayKey();
  // Top categories follow the month on screen (this one otherwise).
  const month = shownMonth(filters) ?? monthOf(today);
  const [data, l] = await Promise.all([
    serverGraphql<{
      transactions: Connection<ApiTransaction>;
      accounts: Connection<ApiAccount>;
      categories: ApiCategory[];
      monthlyReport: ApiMonthlyReport;
      merchantAliases: { id: string; displayName: string }[];
    }>(HISTORY_QUERY, {
      first: HISTORY_PAGE_SIZE,
      after: null,
      filters: toApiFilters(filters),
      ...month,
    }),
    getLocalizer(),
  ]);
  const { locale, t } = l;

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
      rows: topCategoryRows(data.monthlyReport, data.categories, t),
    },
    aliasName: filters.aliasId
      ? (data.merchantAliases.find((a) => a.id === filters.aliasId)
          ?.displayName ?? null)
      : null,
  };
}
