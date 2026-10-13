import 'server-only';

import { serverGraphql } from '@/lib/api/server-graphql';
import { todayKey } from '@/lib/finance/dates';
import { getLocalizer } from '@/lib/i18n/server';
import { projectionsQuery } from './api';
import {
  GOAL_FIELDS,
  RECOMMENDATION_FIELDS,
  type ApiGoal,
  type ApiGoalContribution,
  type ApiGoalProjection,
  type ApiGoalRecommendations,
} from './types';
import { buildGoalsView, parseGoalParam, type GoalsScreenView } from './view';

const GOALS_QUERY = `query Goals {
  goals { ${GOAL_FIELDS} }
  goalRecommendations { ${RECOMMENDATION_FIELDS} }
}`;

export async function loadGoals(
  goalParam: string | string[] | undefined,
): Promise<GoalsScreenView> {
  const [first, l] = await Promise.all([
    serverGraphql<{
      goals: ApiGoal[];
      goalRecommendations: ApiGoalRecommendations;
    }>(GOALS_QUERY),
    getLocalizer(),
  ]);
  const goals = first.goals;
  const detailId = parseGoalParam(goalParam, goals);

  const projections: Record<string, ApiGoalProjection> = {};
  let detail: {
    goalId: string;
    contributions: ApiGoalContribution[];
    recommendations: ApiGoalRecommendations;
  } | null = null;

  if (goals.length > 0) {
    const variables: Record<string, string> = Object.fromEntries(
      goals.map((g, i) => [`g${i}`, g.id]),
    );
    if (detailId) variables.detail = detailId;
    const data = await serverGraphql<
      Record<string, ApiGoalProjection> & {
        contributions?: ApiGoalContribution[];
        detailRecommendations?: ApiGoalRecommendations;
      }
    >(projectionsQuery(goals.length, Boolean(detailId)), variables);
    goals.forEach((g, i) => {
      const projection = data[`p${i}`];
      if (projection) projections[g.id] = projection;
    });
    if (detailId && data.contributions && data.detailRecommendations) {
      detail = {
        goalId: detailId,
        contributions: data.contributions,
        recommendations: data.detailRecommendations,
      };
    }
  }

  return buildGoalsView(
    {
      goals,
      projections,
      recommendations: first.goalRecommendations,
      detail,
    },
    todayKey(),
    l,
  );
}
