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
}

const HISTORY_QUERY = `query History($first: Int!, $after: String, $filters: TransactionFilters, $year: Int!, $month: Int!) {
  ${HISTORY_QUERY_FIELDS}
  accounts(first: 100) { edges { node { ${ACCOUNT_FIELDS} } } }
  categories { ${CATEGORY_FIELDS} }
  monthlyReport(year: $year, month: $month) { ${MONTHLY_REPORT_FIELDS} }
}`;

/** First page of the filtered history plus what the filters and aside need. */
export async function loadHistory(
  filters: HistoryFilters,
): Promise<HistoryData> {
  const today = todayKey();
  const month = monthOf(today);
  const [data, l] = await Promise.all([
    serverGraphql<{
      transactions: Connection<ApiTransaction>;
      accounts: Connection<ApiAccount>;
      categories: ApiCategory[];
      monthlyReport: ApiMonthlyReport;
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
  };
}
