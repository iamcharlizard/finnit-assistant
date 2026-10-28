'use client';

import * as React from 'react';

import { gql } from '@/lib/graphql/client';
import { fetchStatement } from '@/lib/statements/api';
import { POLL_INTERVAL_MS, pollDecision } from '@/lib/statements/poll';
import type { ApiStatementDetail } from '@/lib/statements/types';
import { isWorking } from '@/lib/statements/view';

/**
 * While the statement is being extracted (uploaded/processing), asks for it
 * every 2 s and hands each answer to `onUpdate`; stops when it's done, after
 * ~3 minutes (`timedOut`) or when the page unmounts. A new `startedAt`
 * (e.g. after "Reprocesar") starts a new round.
 */
export function useStatementPolling(
  statement: ApiStatementDetail,
  onUpdate: (statement: ApiStatementDetail) => void,
  startedAt: number,
): { timedOut: boolean } {
  const [timedOut, setTimedOut] = React.useState(false);
  const working = isWorking(statement.status);
  const id = statement.id;
  const update = React.useRef(onUpdate);
  React.useEffect(() => {
    update.current = onUpdate;
  });

  React.useEffect(() => {
    if (!working) return;
    setTimedOut(false);
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      try {
        const next = await fetchStatement(id, gql);
        if (stopped) return;
        update.current(next);
        const decision = pollDecision(next.status, Date.now() - startedAt);
        if (decision === 'timeout') setTimedOut(true);
        if (decision !== 'continue') return;
      } catch {
        // A failed poll (network blip) just tries again, within the time limit.
        if (stopped) return;
        if (pollDecision('processing', Date.now() - startedAt) === 'timeout') {
          setTimedOut(true);
          return;
        }
      }
      timer = setTimeout(() => void tick(), POLL_INTERVAL_MS);
    };
    timer = setTimeout(() => void tick(), POLL_INTERVAL_MS);

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [id, working, startedAt]);

  return { timedOut };
}
