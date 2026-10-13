'use client';

import * as React from 'react';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { gql } from '@/lib/graphql/client';
import { merchantQuery } from '@/lib/new-entry/form';
import { SUGGEST_CATEGORY_QUERY } from '@/lib/new-entry/graphql';

const SUGGEST_DELAY_MS = 500;

/**
 * The category the user's past movements suggest for a merchant, once the
 * merchant input settles. Null while there is none (or it failed: a
 * suggestion is a convenience, never an error).
 */
export function useCategorySuggestion(merchant: string): string | null {
  const query = merchantQuery(useDebouncedValue(merchant, SUGGEST_DELAY_MS));
  const [result, setResult] = React.useState<{
    query: string;
    categoryId: string | null;
  } | null>(null);

  React.useEffect(() => {
    if (!query) return;
    let cancelled = false;
    gql<{ suggestCategoryForMerchant: { id: string } | null }>(
      SUGGEST_CATEGORY_QUERY,
      { input: { merchantName: query } },
    )
      .then((data) => {
        if (!cancelled) {
          setResult({
            query,
            categoryId: data.suggestCategoryForMerchant?.id ?? null,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setResult({ query, categoryId: null });
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  return query && result?.query === query ? result.categoryId : null;
}
