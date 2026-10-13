import type { GqlRunner } from '@/lib/accounts/api';
import type { DayKey } from '@/lib/finance/dates';
import { requestErrorMessage } from '@/lib/graphql/client';
import type { Translate } from '@/lib/i18n/translator';
import {
  buildContributionInput,
  buildCreateGoalInput,
  buildUpdateGoalInput,
  initialContribution,
  type ContributionForm,
  type GoalForm,
} from './form';
import {
  CONTRIBUTION_FIELDS,
  PROJECTION_FIELDS,
  RECOMMENDATION_FIELDS,
  type ApiGoalContribution,
  type ApiGoalProjection,
} from './types';

/** Goal queries and mutations, run from client components through /api/graphql. */

export const CREATE_GOAL_MUTATION = `mutation CreateGoal($input: CreateGoalInput!) { createGoal(input: $input) { id } }`;

export const UPDATE_GOAL_MUTATION = `mutation UpdateGoal($id: ID!, $input: UpdateGoalInput!) { updateGoal(id: $id, input: $input) { id } }`;

export const DELETE_GOAL_MUTATION = `mutation DeleteGoal($id: ID!) { deleteGoal(id: $id) }`;

export const ADD_CONTRIBUTION_MUTATION = `mutation AddGoalContribution($input: CreateGoalContributionInput!) { addGoalContribution(input: $input) { id } }`;

export const REMOVE_CONTRIBUTION_MUTATION = `mutation RemoveGoalContribution($id: ID!) { removeGoalContribution(id: $id) }`;

export const CONTRIBUTIONS_QUERY = `query GoalContributions($goalId: ID!) { goalContributions(goalId: $goalId) { ${CONTRIBUTION_FIELDS} } }`;

export const PROJECTION_QUERY = `query GoalProjection($goalId: ID!, $monthlyContribution: Float) { goalProjection(goalId: $goalId, monthlyContribution: $monthlyContribution) { ${PROJECTION_FIELDS} } }`;

/**
 * One projection per goal (aliased, ids as variables) and, when a goal is
 * open, its contributions and recommendations.
 */
export function projectionsQuery(count: number, withDetail: boolean): string {
  const params = Array.from({ length: count }, (_, i) => `$g${i}: ID!`);
  if (withDetail) params.push('$detail: ID!');
  const fields = Array.from(
    { length: count },
    (_, i) => `p${i}: goalProjection(goalId: $g${i}) { ${PROJECTION_FIELDS} }`,
  );
  if (withDetail) {
    fields.push(
      `contributions: goalContributions(goalId: $detail) { ${CONTRIBUTION_FIELDS} }`,
      `detailRecommendations: goalRecommendations(goalId: $detail) { ${RECOMMENDATION_FIELDS} }`,
    );
  }
  return `query GoalProjections(${params.join(', ')}) {\n  ${fields.join('\n  ')}\n}`;
}

export type GoalSaveTarget =
  | { mode: 'create' }
  | { mode: 'edit'; id: string; initial: GoalForm };

export interface GoalSaveResult {
  /** False when an edit changed nothing. */
  changed: boolean;
  goalId: string | null;
  /** The goal was created but its first contribution failed. */
  initialFailed?: unknown;
}

/**
 * Saves the goal dialog. A new goal's "already saved" amount becomes its
 * first contribution (createGoal takes no starting amount).
 */
export async function saveGoal(
  form: GoalForm,
  target: GoalSaveTarget,
  run: GqlRunner,
  today: DayKey,
): Promise<GoalSaveResult> {
  if (target.mode === 'edit') {
    const input = buildUpdateGoalInput(form, target.initial);
    if (!input) return { changed: false, goalId: target.id };
    await run(UPDATE_GOAL_MUTATION, { id: target.id, input });
    return { changed: true, goalId: target.id };
  }
  const data = await run<{ createGoal: { id: string } }>(CREATE_GOAL_MUTATION, {
    input: buildCreateGoalInput(form),
  });
  const goalId = data.createGoal.id;
  const first = initialContribution(form, goalId, today);
  if (first) {
    try {
      await run(ADD_CONTRIBUTION_MUTATION, { input: first });
    } catch (error) {
      return { changed: true, goalId, initialFailed: error };
    }
  }
  return { changed: true, goalId };
}

export async function addContribution(
  goalId: string,
  form: ContributionForm,
  run: GqlRunner,
): Promise<void> {
  await run(ADD_CONTRIBUTION_MUTATION, {
    input: buildContributionInput(goalId, form),
  });
}

export async function removeContribution(
  id: string,
  run: GqlRunner,
): Promise<void> {
  await run(REMOVE_CONTRIBUTION_MUTATION, { id });
}

export async function deleteGoal(id: string, run: GqlRunner): Promise<void> {
  await run(DELETE_GOAL_MUTATION, { id });
}

/**
 * The API refuses to delete a goal with contributions: removes them one by
 * one (each adjusts the saved amount) and then the goal.
 */
export async function deleteGoalWithContributions(
  id: string,
  run: GqlRunner,
): Promise<void> {
  const data = await run<{ goalContributions: ApiGoalContribution[] }>(
    CONTRIBUTIONS_QUERY,
    { goalId: id },
  );
  for (const contribution of data.goalContributions) {
    await run(REMOVE_CONTRIBUTION_MUTATION, { id: contribution.id });
  }
  await run(DELETE_GOAL_MUTATION, { id });
}

export async function fetchProjection(
  goalId: string,
  monthlyContribution: number,
  run: GqlRunner,
): Promise<ApiGoalProjection> {
  const data = await run<{ goalProjection: ApiGoalProjection }>(
    PROJECTION_QUERY,
    { goalId, monthlyContribution },
  );
  return data.goalProjection;
}

/** deleteGoal's refusal while the goal has contributions. */
export function hasContributionsError(error: unknown): boolean {
  const message = (error as { message?: string } | null)?.message ?? '';
  return /existing contributions/i.test(message);
}

/** API messages are English; show ours in the user's language. */
const MESSAGES: [RegExp, Parameters<Translate>[0]][] = [
  [/name already exists|unique constraint/i, 'goals.errors.duplicateName'],
  [/goal has already been reached/i, 'goals.errors.alreadyReached'],
  [/existing contributions/i, 'goals.errors.hasContributions'],
  [/target amount must be/i, 'goals.errors.target'],
  [/contribution must be/i, 'goals.errors.amount'],
  [/goal needs a name/i, 'goals.errors.name'],
  [/contribution not found/i, 'goals.errors.contributionNotFound'],
  [/goal not found/i, 'goals.errors.notFound'],
];

export function goalErrorMessage(error: unknown, t: Translate): string {
  const message = (error as { message?: string } | null)?.message ?? '';
  const known = MESSAGES.find(([pattern]) => pattern.test(message));
  if (known) return t(known[1]);
  const code = (error as { code?: string } | null)?.code;
  if (code === 'INTERNAL_SERVER_ERROR') return t('errors.unexpected');
  return requestErrorMessage(error, t);
}
