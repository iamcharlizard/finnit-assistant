'use client';

import * as React from 'react';

import { fetchPage } from '@/lib/categorize/api';
import type { CategorizeFilters } from '@/lib/categorize/filters';
import type {
  CategorizePageData,
  CategorizeTransaction,
} from '@/lib/categorize/types';
import { appendPage, mergeTransactions } from '@/lib/categorize/view';
import { gql, requestErrorMessage } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';

/**
 * The categorize list: the first page comes from the server; "Cargar más"
 * fetches the next ones with the cursor, and `reload` asks again for the
 * rows on screen after a bulk change. Mount it again (React key) when the
 * filters change.
 */
export function useCategorizePages(
  initial: CategorizePageData,
  filters: CategorizeFilters,
) {
  const [page, setPage] = React.useState(initial);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const { t } = useLocalizer();

  const loadMore = React.useCallback(async () => {
    if (!page.hasNextPage || loading) return;
    setLoading(true);
    setError(null);
    try {
      const next = await fetchPage(filters, { after: page.endCursor }, gql);
      setPage((current) => ({
        ...next,
        transactions: appendPage(current.transactions, next.transactions),
      }));
    } catch (e) {
      setError(requestErrorMessage(e, t));
    } finally {
      setLoading(false);
    }
  }, [page.hasNextPage, page.endCursor, loading, filters, t]);

  /** Reloads from the top as many rows as are on screen (rows that left the filter go away). */
  const reload = React.useCallback(async () => {
    setError(null);
    try {
      const fresh = await fetchPage(
        filters,
        { loaded: page.transactions.length },
        gql,
      );
      setPage(fresh);
    } catch (e) {
      setError(requestErrorMessage(e, t));
    }
  }, [filters, page.transactions.length, t]);

  /** Shows updated transactions (e.g. new AI suggestions) in place. */
  const merge = React.useCallback(
    (updates: ReadonlyArray<CategorizeTransaction>) => {
      setPage((current) => ({
        ...current,
        transactions: mergeTransactions(current.transactions, updates),
      }));
    },
    [],
  );

  return { ...page, loading, error, loadMore, reload, merge };
}
