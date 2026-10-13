'use client';

import * as React from 'react';

import { gql } from '@/lib/graphql/client';
import { loadSuggestions } from '@/lib/recurring/api';
import type { ApiRecurringSuggestion } from '@/lib/recurring/types';

export type SuggestionsState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; items: ApiRecurringSuggestion[] };

/*
 * Kept for the browser session: changing the calendar's period remounts the
 * screen (new search params under the route's loading boundary), and the
 * first detection may call AI, so it must not run again on every move.
 */
let cache: SuggestionsState = { status: 'loading' };
let inflight: Promise<void> | null = null;
/** Whose suggestions the cache holds: another user starts over. */
let owner: string | null = null;
const listeners = new Set<() => void>();

function set(next: SuggestionsState) {
  cache = next;
  for (const listener of listeners) listener();
}

function fetchSuggestions(): Promise<void> {
  const user = owner;
  const settle = (next: SuggestionsState) => {
    if (owner === user) set(next);
  };
  inflight ??= loadSuggestions(gql)
    .then(
      (items) => settle({ status: 'ready', items }),
      (error: unknown) => settle({ status: 'error', error }),
    )
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const LOADING: SuggestionsState = { status: 'loading' };

/**
 * Recurring-payment suggestions, fetched once in the browser after the
 * screen first renders; only "Reintentar" fetches them again.
 */
export function useRecurringSuggestions(userId: string) {
  if (owner !== userId) {
    owner = userId;
    cache = LOADING;
    inflight = null;
  }
  const state = React.useSyncExternalStore(
    subscribe,
    () => cache,
    () => LOADING,
  );

  React.useEffect(() => {
    if (cache.status === 'loading') void fetchSuggestions();
  }, [userId]);

  const reload = React.useCallback(() => {
    set({ status: 'loading' });
    return fetchSuggestions();
  }, []);

  /** Takes a suggestion off the list (accepted or dismissed). */
  const remove = React.useCallback((fingerprint: string) => {
    if (cache.status !== 'ready') return;
    set({
      status: 'ready',
      items: cache.items.filter((s) => s.fingerprint !== fingerprint),
    });
  }, []);

  /** Puts a suggestion back where it was (a dismiss that failed). */
  const restore = React.useCallback(
    (suggestion: ApiRecurringSuggestion, index: number) => {
      if (cache.status !== 'ready') return;
      if (cache.items.some((s) => s.fingerprint === suggestion.fingerprint)) {
        return;
      }
      const items = [...cache.items];
      items.splice(Math.min(index, items.length), 0, suggestion);
      set({ status: 'ready', items });
    },
    [],
  );

  return { state, reload, remove, restore };
}
