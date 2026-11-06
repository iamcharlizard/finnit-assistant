/** The goals screen's first request, shared by the web loader and the mobile app. */
import { GOAL_FIELDS, RECOMMENDATION_FIELDS } from './types';

export const GOALS_QUERY = `query Goals {
  goals { ${GOAL_FIELDS} }
  goalRecommendations { ${RECOMMENDATION_FIELDS} }
}`;

export { projectionsQuery } from './api';
