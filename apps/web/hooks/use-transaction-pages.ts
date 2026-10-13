'use client';

import * as React from 'react';

import { indexCategories } from '@/lib/finance/categories';
import type {
  ApiCategory,
  ApiTransaction,
  Connection,
} from '@/lib/finance/types';
import { gql, requestErrorMessage } from '@/lib/graphql/client';
import {
  HISTORY_PAGE_SIZE,
  toApiFilters,
  type HistoryFilters,
} from '@/lib/history/filters';
import {
  TRANSACTIONS_PAGE_QUERY,
  toTransactionPage,
  type TransactionPage,
} from '@/lib/history/view';
import { useLocalizer } from '@/lib/i18n/client';

/**
 * The history list: the first page comes from the server; "Cargar más"
 * fetches the next ones with the cursor. Mount it again (React key) when the
 * filters change.
 */
export function useTransactionPages(
  initial: TransactionPage,
  filters: HistoryFilters,
  categories: ReadonlyArray<ApiCategory>,
) {
  const [page, setPage] = React.useState(initial);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const index = React.useMemo(() => indexCategories(categories), [categories]);
  const l = useLocalizer();

  const loadMore = React.useCallback(async () => {
    if (!page.hasNextPage || loading) return;
    setLoading(true);
    setError(null);
    try {
      const { transactions } = await gql<{
        transactions: Connection<ApiTransaction>;
      }>(TRANSACTIONS_PAGE_QUERY, {
        first: HISTORY_PAGE_SIZE,
        after: page.endCursor,
        filters: toApiFilters(filters),
      });
      const next = toTransactionPage(transactions, index, l);
      setPage((current) => {
        // Never show a row twice, even if the list changed meanwhile.
        const seen = new Set(current.rows.map((r) => r.id));
        return {
          ...next,
          rows: [...current.rows, ...next.rows.filter((r) => !seen.has(r.id))],
        };
      });
    } catch (e) {
      setError(requestErrorMessage(e, l.t));
    } finally {
      setLoading(false);
    }
  }, [page.hasNextPage, page.endCursor, loading, filters, index, l]);

  return { ...page, loading, error, loadMore };
}
