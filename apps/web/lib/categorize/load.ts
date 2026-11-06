import 'server-only';

import { serverGraphql } from '@/lib/api/server-graphql';
import { todayKey, type DayKey } from '@finnit/core/finance/dates';
import type { Connection } from '@finnit/core/finance/types';
import type { EntryAccount } from '@finnit/core/new-entry/graphql';
import { getLocalizer } from '@/lib/i18n/server';
import {
  TRANSFER_SUGGESTIONS_FIELDS,
  toSuggestionView,
  type ApiTransferSuggestion,
  type TransferSuggestionView,
} from '@finnit/core/transfers/suggestions';
import { CATEGORIZE_CONNECTION, toPageData } from '@finnit/core/categorize/api';
import { pageVariables, type CategorizeFilters } from '@finnit/core/categorize/filters';
import type {
  CategorizeCategory,
  CategorizePageData,
  CategorizeTransaction,
} from '@finnit/core/categorize/types';

export interface CategorizeData {
  today: DayKey;
  page: CategorizePageData;
  accounts: EntryAccount[];
  categories: CategorizeCategory[];
  /** Bank movements that look like transfers between own accounts. */
  transferSuggestions: { rows: TransferSuggestionView[]; total: number };
}

const CATEGORIZE_QUERY = `query Categorize($first: Int!, $after: String, $filters: TransactionFilters) {
  ${CATEGORIZE_CONNECTION}
  accounts(first: 100) { edges { node { id name type currency balanceCurrent archived metadata { nickname bank last4 } } } }
  categories { id name parentId key kind icon }
  ${TRANSFER_SUGGESTIONS_FIELDS}
}`;

/** First page of the filtered movements plus the account and category pickers. */
export async function loadCategorize(
  filters: CategorizeFilters,
): Promise<CategorizeData> {
  const [data, l] = await Promise.all([
    serverGraphql<{
      transactions: Connection<CategorizeTransaction>;
      accounts: Connection<EntryAccount>;
      categories: CategorizeCategory[];
      transferSuggestions: Connection<ApiTransferSuggestion>;
    }>(CATEGORIZE_QUERY, pageVariables(filters)),
    getLocalizer(),
  ]);
  return {
    today: todayKey(),
    page: toPageData(data.transactions),
    accounts: data.accounts.edges.map((e) => e.node),
    categories: data.categories,
    transferSuggestions: {
      rows: data.transferSuggestions.edges.map((e) =>
        toSuggestionView(e.node, l),
      ),
      total: data.transferSuggestions.totalCount,
    },
  };
}
