'use client';

import * as React from 'react';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { fetchProjection } from '@/lib/goals/api';
import type { ApiGoalProjection } from '@/lib/goals/types';
import { gql } from '@/lib/graphql/client';

export type ProjectionState =
  | { status: 'ready'; projection: ApiGoalProjection }
  | { status: 'loading'; projection: ApiGoalProjection }
  | { status: 'error'; projection: ApiGoalProjection; error: unknown };

/**
 * The goal's projection for the monthly amount being typed: asks the API
 * (goalProjection with monthlyContribution) once the typing stops. While
 * nothing valid is typed (`null`) the last answer stays.
 */
export function useGoalProjection(
  goalId: string,
  initial: ApiGoalProjection,
  monthly: number | null,
): ProjectionState {
  const debounced = useDebouncedValue(monthly, 400);
  const [result, setResult] = React.useState<{
    monthly: number;
    projection: ApiGoalProjection | null;
    error?: unknown;
  } | null>(null);
  const [last, setLast] = React.useState(initial);

  const wanted = monthly ?? result?.monthly ?? initial.monthlyContribution;
  const needsFetch =
    debounced !== null && debounced !== initial.monthlyContribution;

  React.useEffect(() => {
    if (!needsFetch || debounced === null) return;
    let cancelled = false;
    fetchProjection(goalId, debounced, gql).then(
      (projection) => {
        if (cancelled) return;
        setResult({ monthly: debounced, projection });
        setLast(projection);
      },
      (error: unknown) => {
        if (!cancelled)
          setResult({ monthly: debounced, projection: null, error });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [goalId, debounced, needsFetch]);

  if (wanted === initial.monthlyContribution) {
    return { status: 'ready', projection: initial };
  }
  if (result?.monthly === wanted) {
    return result.projection
      ? { status: 'ready', projection: result.projection }
      : { status: 'error', projection: last, error: result.error };
  }
  return { status: 'loading', projection: last };
}
