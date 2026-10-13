'use client';

import * as React from 'react';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { loadPayoffComparison } from '@/lib/debts/api';
import {
  buildPayoffComparison,
  parseExtraPayment,
  type PayoffComparison,
} from '@/lib/debts/payoff';
import type { DayKey } from '@/lib/finance/dates';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';

export type PayoffState =
  | { status: 'ready'; plan: PayoffComparison }
  | { status: 'loading'; plan: PayoffComparison | null }
  | { status: 'error' }
  | { status: 'invalid'; plan: PayoffComparison | null };

const DEBOUNCE_MS = 400;

/**
 * Avalanche vs Snowball for the debts still owed, recomputed (debounced)
 * when the extra monthly payment changes. With no extra payment it is the
 * server's plan. Only the latest answer is kept.
 */
export function usePayoffComparison({
  debtIds,
  stamp,
  initial,
  today,
}: {
  debtIds: string[];
  /** Changes whenever a debt's numbers do (after saving a payment…). */
  stamp: string;
  /** The plan with no extra payment (null without debts to pay). */
  initial: PayoffComparison | null;
  today: DayKey;
}) {
  const l = useLocalizer();
  const [extraText, setExtraText] = React.useState('');
  const extra = parseExtraPayment(extraText);
  const ids = debtIds.join(',');
  const requestKey = extra === null ? null : `${stamp}|${extra}`;
  // Memoized: the debounce compares by identity.
  const request = React.useMemo(
    () =>
      requestKey && extra !== null ? { key: requestKey, ids, extra } : null,
    [requestKey, ids, extra],
  );
  const debounced = useDebouncedValue(request, DEBOUNCE_MS);
  const [result, setResult] = React.useState<{
    key: string;
    plan: PayoffComparison | null;
  } | null>(null);

  React.useEffect(() => {
    // No extra payment: the server's plan already covers it.
    if (!debounced || !debounced.ids || debounced.extra === 0) return;
    let cancelled = false;
    loadPayoffComparison(debounced.ids.split(','), debounced.extra, gql)
      .then((plans) => {
        if (!cancelled) {
          setResult({
            key: debounced.key,
            plan: buildPayoffComparison(plans, { today }, l),
          });
        }
      })
      .catch(() => {
        if (!cancelled) setResult({ key: debounced.key, plan: null });
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, today, l]);

  const shown = result?.plan ?? initial;
  let state: PayoffState | null;
  if (!ids || !initial) state = null;
  else if (extra === null) state = { status: 'invalid', plan: shown };
  else if (extra === 0) state = { status: 'ready', plan: initial };
  else if (result?.key === requestKey) {
    state = result.plan
      ? { status: 'ready', plan: result.plan }
      : { status: 'error' };
  } else state = { status: 'loading', plan: shown };

  return { extraText, setExtraText, state };
}
