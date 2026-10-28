import type { GqlRunner } from '@/lib/accounts/api';
import type { MonthRef } from '@/lib/finance/dates';
import { requestErrorMessage } from '@/lib/graphql/client';
import type { Translate } from '@/lib/i18n/translator';
import {
  buildCreateBudgetInput,
  buildUpdateBudgetInput,
  type BudgetForm,
} from './form';

/** Budget mutations, run from client components through /api/graphql. */

export const CREATE_BUDGET_MUTATION = `mutation CreateBudget($input: CreateBudgetInput!) { createBudget(input: $input) { id } }`;

export const UPDATE_BUDGET_MUTATION = `mutation UpdateBudget($id: String!, $input: UpdateBudgetInput!) { updateBudget(id: $id, input: $input) { id } }`;

export const DELETE_BUDGET_MUTATION = `mutation DeleteBudget($id: String!) { deleteBudget(id: $id) }`;

export const COPY_BUDGET_MUTATION = `mutation CreateBudgetFromTemplate($input: BudgetFromTemplateInput!) { createBudgetFromTemplate(input: $input) { id } }`;

/** What the dialog saves: a new budget for a month, or an existing one. */
export type BudgetTarget =
  | { mode: 'create'; month: MonthRef; currency: string }
  | { mode: 'edit'; id: string };

export async function saveBudget(
  form: BudgetForm,
  target: BudgetTarget,
  run: GqlRunner,
): Promise<void> {
  if (target.mode === 'create') {
    await run(CREATE_BUDGET_MUTATION, {
      input: buildCreateBudgetInput(form, target),
    });
    return;
  }
  await run(UPDATE_BUDGET_MUTATION, {
    id: target.id,
    input: buildUpdateBudgetInput(form),
  });
}

export async function copyBudget(
  templateBudgetId: string,
  month: MonthRef,
  run: GqlRunner,
): Promise<void> {
  await run(COPY_BUDGET_MUTATION, {
    input: { templateBudgetId, year: month.year, month: month.month },
  });
}

export async function deleteBudget(id: string, run: GqlRunner): Promise<void> {
  await run(DELETE_BUDGET_MUTATION, { id });
}

/** API messages are English; show ours in the user's language. */
const MESSAGES: [RegExp, Parameters<Translate>[0]][] = [
  [/already exists for this month/i, 'budgets.errors.exists'],
  [/template budget not found/i, 'budgets.errors.templateGone'],
  [/budget not found/i, 'budgets.errors.notFound'],
  [/unique constraint/i, 'budgets.errors.repeatedCategory'],
  [/foreign key/i, 'budgets.errors.category'],
];

export function budgetErrorMessage(error: unknown, t: Translate): string {
  const message = (error as { message?: string } | null)?.message ?? '';
  const known = MESSAGES.find(([pattern]) => pattern.test(message));
  if (known) return t(known[1]);
  const code = (error as { code?: string } | null)?.code;
  if (code === 'INTERNAL_SERVER_ERROR') return t('errors.unexpected');
  return requestErrorMessage(error, t);
}
