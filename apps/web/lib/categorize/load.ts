import 'server-only';

import { serverGraphql } from '@/lib/api/server-graphql';
import { todayKey, type DayKey } from '@finnit/core/finance/dates';
import type { Connection } from '@finnit/core/finance/types';
import type { EntryAccount } from '@finnit/core/new-entry/graphql';
import { getLocalizer } from '@/lib/i18n/server';
import {
  toSuggestionView,
  type ApiTransferSuggestion,
  type TransferSuggestionView,
} from '@finnit/core/transfers/suggestions';
import { toPageData } from '@finnit/core/categorize/api';
import { CATEGORIZE_QUERY } from '@finnit/core/categorize/request';
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
