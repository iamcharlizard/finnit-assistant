import 'server-only';

import { serverGraphql } from '@/lib/api/server-graphql';
import { todayKey, type DayKey } from '@/lib/finance/dates';
import type { Connection } from '@/lib/finance/types';
import type { EntryAccount } from '@/lib/new-entry/graphql';
import { CATEGORIZE_CONNECTION, toPageData } from './api';
import { pageVariables, type CategorizeFilters } from './filters';
import type {
  CategorizeCategory,
  CategorizePageData,
  CategorizeTransaction,
} from './types';

export interface CategorizeData {
  today: DayKey;
  page: CategorizePageData;
  accounts: EntryAccount[];
  categories: CategorizeCategory[];
}

const CATEGORIZE_QUERY = `query Categorize($first: Int!, $after: String, $filters: TransactionFilters) {
  ${CATEGORIZE_CONNECTION}
  accounts(first: 100) { edges { node { id name type currency balanceCurrent archived metadata { nickname bank last4 } } } }
  categories { id name parentId key }
}`;

/** First page of the filtered movements plus the account and category pickers. */
export async function loadCategorize(
  filters: CategorizeFilters,
): Promise<CategorizeData> {
  const data = await serverGraphql<{
    transactions: Connection<CategorizeTransaction>;
    accounts: Connection<EntryAccount>;
    categories: CategorizeCategory[];
  }>(CATEGORIZE_QUERY, pageVariables(filters));
  return {
    today: todayKey(),
    page: toPageData(data.transactions),
    accounts: data.accounts.edges.map((e) => e.node),
    categories: data.categories,
  };
}
