import * as React from 'react';

import { requestErrorMessage } from '@finnit/core/graphql/request';
import { GOALS_QUERY, projectionsQuery } from '@finnit/core/goals/request';
import type { ApiGoal, ApiGoalContribution, ApiGoalProjection, ApiGoalRecommendations } from '@finnit/core/goals/types';
import { buildGoalsView, type GoalsScreenView } from '@finnit/core/goals/view';
import { todayKey } from '@finnit/core/finance/dates';

import { useGql } from '@/lib/graphql/runner';
import { useLocalizer } from '@/lib/i18n/i18n-provider';

/**
 * The goals and, for `detailId`, its contributions and recommendations:
 * the web's loadGoals (two requests: the goals, then their projections).
 */
export function useGoals(detailId: string | null) {
  const gql = useGql();
  const l = useLocalizer();
  const [view, setView] = React.useState<GoalsScreenView | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const first = await gql<{ goals: ApiGoal[]; goalRecommendations: ApiGoalRecommendations }>(GOALS_QUERY);
      const goals = first.goals;
      const detailGoal = detailId && goals.some((g) => g.id === detailId) ? detailId : null;
      const projections: Record<string, ApiGoalProjection> = {};
      let detail: { goalId: string; contributions: ApiGoalContribution[]; recommendations: ApiGoalRecommendations } | null = null;
      if (goals.length > 0) {
        const variables: Record<string, string> = Object.fromEntries(goals.map((g, i) => [`g${i}`, g.id]));
        if (detailGoal) variables.detail = detailGoal;
        const data = await gql<
          Record<string, ApiGoalProjection> & { contributions?: ApiGoalContribution[]; detailRecommendations?: ApiGoalRecommendations }
        >(projectionsQuery(goals.length, Boolean(detailGoal)), variables);
        goals.forEach((g, i) => {
          const projection = data[`p${i}`];
          if (projection) projections[g.id] = projection;
        });
        if (detailGoal && data.contributions && data.detailRecommendations) {
          detail = { goalId: detailGoal, contributions: data.contributions, recommendations: data.detailRecommendations };
        }
      }
      setView(buildGoalsView({ goals, projections, recommendations: first.goalRecommendations, detail }, todayKey(), l));
    } catch (e) {
      setError(requestErrorMessage(e, l.t));
    } finally {
      setLoading(false);
    }
  }, [gql, l, detailId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return { view, error, loading, reload: load };
}
