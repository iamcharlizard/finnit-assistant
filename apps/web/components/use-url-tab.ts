'use client';

import * as React from 'react';

import { parseTab, withTab } from '@finnit/core/recurring/tabs';

/**
 * A screen's tab kept in `?tab=` without navigating (a reload keeps it):
 * starts from the URL and writes it back on change.
 */
export function useUrlTab<T extends string>(
  tabs: readonly [T, ...T[]],
): [T, (value: string) => void] {
  const [tab, setTab] = React.useState<T>(tabs[0]);
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setTab(parseTab(tabs, params.get('tab') ?? undefined));
  }, [tabs]);
  const change = React.useCallback(
    (value: string) => {
      const next = parseTab(tabs, value);
      setTab(next);
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${withTab(tabs, window.location.search, next)}`,
      );
    },
    [tabs],
  );
  return [tab, change];
}
