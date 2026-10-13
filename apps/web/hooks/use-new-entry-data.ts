'use client';

import * as React from 'react';

import { gql } from '@/lib/graphql/client';
import {
  NEW_ENTRY_DATA_QUERY,
  type EntryAccount,
  type EntryCategory,
  type NewEntryData,
} from '@/lib/new-entry/graphql';

export type NewEntryDataState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | {
      status: 'ready';
      accounts: EntryAccount[];
      categories: EntryCategory[];
    };

/**
 * Accounts and categories for the create flow, fetched each time the sheet
 * opens (`active`) so balances and new accounts are current.
 */
export function useNewEntryData(active: boolean): {
  state: NewEntryDataState;
  reload: () => void;
} {
  const [state, setState] = React.useState<NewEntryDataState>({
    status: 'loading',
  });
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setState({ status: 'loading' });
    gql<NewEntryData>(NEW_ENTRY_DATA_QUERY)
      .then((data) => {
        if (cancelled) return;
        setState({
          status: 'ready',
          accounts: data.accounts.edges.map((e) => e.node),
          categories: data.categories,
        });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ status: 'error', error });
      });
    return () => {
      cancelled = true;
    };
  }, [active, attempt]);

  const reload = React.useCallback(() => setAttempt((n) => n + 1), []);
  return { state, reload };
}
