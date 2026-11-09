'use client';

import * as React from 'react';

/**
 * Infinite scroll: a ref for an element at the end of a list; when it comes
 * near the viewport (600px before), `loadMore` runs. Pass `enabled` false
 * while a page loads: when it turns true again the end is observed anew, so
 * if it is still in sight the next page loads too.
 */
export function useLoadMoreSentinel(
  loadMore: () => void,
  enabled: boolean,
): React.RefCallback<HTMLElement> {
  const latest = React.useRef(loadMore);
  React.useEffect(() => {
    latest.current = loadMore;
  }, [loadMore]);
  const observer = React.useRef<IntersectionObserver | null>(null);

  return React.useCallback(
    (node: HTMLElement | null) => {
      observer.current?.disconnect();
      observer.current = null;
      if (!node || !enabled) return;
      observer.current = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) latest.current();
        },
        { rootMargin: '600px 0px' },
      );
      observer.current.observe(node);
    },
    [enabled],
  );
}

/**
 * Keeps `?n=` (how many rows are loaded) in the URL without navigating, so
 * a reload — the page refreshing after an edit, or the browser's — brings
 * every loaded row back.
 */
export function useShownInUrl(
  rows: number,
  param: (rows: number) => string | null,
  key: string,
) {
  React.useEffect(() => {
    const url = new URL(window.location.href);
    const value = param(rows);
    if (url.searchParams.get(key) === value) return;
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
    window.history.replaceState(window.history.state, '', url);
  }, [rows, param, key]);
}
