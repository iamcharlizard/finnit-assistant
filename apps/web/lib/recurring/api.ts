import type { GqlRunner } from '@/lib/accounts/api';
import { requestErrorMessage } from '@/lib/graphql/client';
import type { Translate } from '@/lib/i18n/translator';
import {
  buildAcceptInput,
  buildCreateInput,
  buildUpdateInput,
  type RecurringForm,
} from './form';
import {
  RECURRING_SUGGESTION_FIELDS,
  type ApiRecurringSuggestion,
} from './types';

/** Recurring-payment mutations, run from client components through /api/graphql. */

export const CREATE_MUTATION = `mutation CreateRecurringExpense($input: CreateRecurringExpenseInput!) { createRecurringExpense(input: $input) { id } }`;

export const UPDATE_MUTATION = `mutation UpdateRecurringExpense($id: ID!, $input: UpdateRecurringExpenseInput!) { updateRecurringExpense(id: $id, input: $input) { id } }`;

export const DELETE_MUTATION = `mutation DeleteRecurringExpense($id: ID!) { deleteRecurringExpense(id: $id) }`;

export const MARK_PAID_MUTATION = `mutation MarkRecurringPaymentPaid($occurrenceId: ID!) { markRecurringPaymentPaid(occurrenceId: $occurrenceId) { id status } }`;

export const SKIP_MUTATION = `mutation SkipRecurringPayment($occurrenceId: ID!) { skipRecurringPayment(occurrenceId: $occurrenceId) { id status } }`;

export const REOPEN_MUTATION = `mutation ReopenRecurringPayment($occurrenceId: ID!) { reopenRecurringPayment(occurrenceId: $occurrenceId) { id status } }`;

export const SUGGESTIONS_QUERY = `query RecurringSuggestions { recurringSuggestions { ${RECURRING_SUGGESTION_FIELDS} } }`;

export const ACCEPT_SUGGESTION_MUTATION = `mutation AcceptRecurringSuggestion($fingerprint: ID!, $input: AcceptRecurringSuggestionInput) { acceptRecurringSuggestion(fingerprint: $fingerprint, input: $input) { id } }`;

export const DISMISS_SUGGESTION_MUTATION = `mutation DismissRecurringSuggestion($fingerprint: ID!) { dismissRecurringSuggestion(fingerprint: $fingerprint) }`;

export type PaymentAction = 'pay' | 'skip' | 'reopen';

const PAYMENT_MUTATIONS: Record<PaymentAction, string> = {
  pay: MARK_PAID_MUTATION,
  skip: SKIP_MUTATION,
  reopen: REOPEN_MUTATION,
};

export async function runPaymentAction(
  action: PaymentAction,
  occurrenceId: string,
  run: GqlRunner,
): Promise<void> {
  await run(PAYMENT_MUTATIONS[action], { occurrenceId });
}

/** What the dialog is saving: a new expense, an edit, or a suggestion. */
export type SaveTarget =
  | { mode: 'create' }
  | { mode: 'edit'; id: string; initial: RecurringForm }
  | { mode: 'suggestion'; fingerprint: string; initial: RecurringForm };

/**
 * Saves the dialog. Returns false when an edit changed nothing. Accepting a
 * suggestion is one mutation plus, when needed, an update with the fields
 * acceptRecurringSuggestion doesn't take.
 */
export async function saveRecurring(
  form: RecurringForm,
  target: SaveTarget,
  run: GqlRunner,
): Promise<boolean> {
  if (target.mode === 'create') {
    await run(CREATE_MUTATION, { input: buildCreateInput(form) });
    return true;
  }
  if (target.mode === 'edit') {
    const input = buildUpdateInput(form, target.initial);
    if (!input) return false;
    await run(UPDATE_MUTATION, { id: target.id, input });
    return true;
  }
  const { input, followUp } = buildAcceptInput(form, target.initial);
  const data = await run<{ acceptRecurringSuggestion: { id: string } }>(
    ACCEPT_SUGGESTION_MUTATION,
    { fingerprint: target.fingerprint, input },
  );
  if (followUp) {
    await run(UPDATE_MUTATION, {
      id: data.acceptRecurringSuggestion.id,
      input: followUp,
    });
  }
  return true;
}

export async function setRecurringActive(
  id: string,
  active: boolean,
  run: GqlRunner,
): Promise<void> {
  await run(UPDATE_MUTATION, { id, input: { active } });
}

export async function deleteRecurring(id: string, run: GqlRunner) {
  await run(DELETE_MUTATION, { id });
}

export async function loadSuggestions(
  run: GqlRunner,
): Promise<ApiRecurringSuggestion[]> {
  const data = await run<{ recurringSuggestions: ApiRecurringSuggestion[] }>(
    SUGGESTIONS_QUERY,
  );
  return data.recurringSuggestions;
}

export async function dismissSuggestion(fingerprint: string, run: GqlRunner) {
  await run(DISMISS_SUGGESTION_MUTATION, { fingerprint });
}

/** API messages are English; show ours in the user's language. */
const MESSAGES: [RegExp, Parameters<Translate>[0]][] = [
  [/name already exists/i, 'recurring.errors.duplicateName'],
  [/amount must be/i, 'recurring.errors.amount'],
  [/interval must be/i, 'recurring.errors.interval'],
  [/end date must be/i, 'recurring.errors.endDate'],
  [/need the total number of installments/i, 'recurring.errors.installments'],
  [/paid installments cannot exceed/i, 'recurring.errors.installmentsPaid'],
  [/account not found/i, 'recurring.errors.account'],
  [/category not found/i, 'recurring.errors.category'],
  [/recurring expense not found/i, 'recurring.errors.notFound'],
  [/recurring payment not found/i, 'recurring.errors.paymentNotFound'],
  [/already marked as paid/i, 'recurring.errors.alreadyPaid'],
  [/reopen the payment before/i, 'recurring.errors.reopenFirst'],
  [/suggestion not found/i, 'recurring.errors.suggestionGone'],
];

export function recurringErrorMessage(error: unknown, t: Translate): string {
  const message = (error as { message?: string } | null)?.message ?? '';
  const known = MESSAGES.find(([pattern]) => pattern.test(message));
  if (known) return t(known[1]);
  const code = (error as { code?: string } | null)?.code;
  if (code === 'INTERNAL_SERVER_ERROR') return t('errors.unexpected');
  return requestErrorMessage(error, t);
}
