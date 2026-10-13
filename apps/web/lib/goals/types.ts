/**
 * Shapes of the savings-goals API (feature 7) and the GraphQL field
 * selections that fetch them.
 */
export interface ApiGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: string;
  /** Calendar date (midnight UTC) or null when the goal has no deadline. */
  dueDate: string | null;
  createdAt: string;
}

export const GOAL_FIELDS =
  'id name targetAmount currentAmount currency dueDate createdAt';

export interface ApiGoalProjection {
  goalId: string;
  /** The amount given, or the average of the last 3 months of contributions. */
  monthlyContribution: number;
  /** 0 when reached; null when the monthly contribution is 0. */
  monthsRemaining: number | null;
  completionDate: string | null;
}

export const PROJECTION_FIELDS =
  'goalId monthlyContribution monthsRemaining completionDate';

export interface ApiGoalContribution {
  id: string;
  goalId: string;
  amount: number;
  date: string;
  transactionId: string | null;
}

export const CONTRIBUTION_FIELDS = 'id goalId amount date transactionId';

export interface ApiGoalRecommendations {
  totalGoalsAmount: number;
  totalSavedAmount: number;
  /** Percent. */
  averageProgress: number;
  /** What is left, spread over 12 months. */
  recommendedMonthlyContribution: number;
  goalsDueSoon: { id: string; name: string }[];
  goalsAtRisk: { id: string; name: string }[];
}

export const RECOMMENDATION_FIELDS =
  'totalGoalsAmount totalSavedAmount averageProgress recommendedMonthlyContribution goalsDueSoon { id name } goalsAtRisk { id name }';
