import type { GqlRunner } from '@/lib/accounts/api';
import { requestErrorMessage } from '@/lib/graphql/client';
import type { Translate } from '@/lib/i18n/translator';
import type { UpdateTransactionPayload } from './form';
import type { SimilarCategory } from './types';

/** The detail's mutations, run from client components through /api/graphql. */

export const UPDATE_TRANSACTION_MUTATION = `mutation UpdateTransaction($id: String!, $input: UpdateTransactionInput!) { updateTransaction(id: $id, input: $input) { id } }`;

export const SET_ALIAS_MUTATION = `mutation SetTransactionAlias($id: ID!, $input: TransactionAliasInput!) { setTransactionAlias(id: $id, input: $input) { id } }`;

export const DELETE_TRANSACTION_MUTATION = `mutation DeleteTransaction($id: String!) { deleteTransaction(id: $id) }`;

export const REMOVE_ATTACHMENT_MUTATION = `mutation RemoveTransactionAttachment($id: String!) { removeTransactionAttachment(id: $id) }`;

export const SIMILAR_CATEGORY_QUERY = `query SimilarCategory($id: ID!) { similarCategory(transactionId: $id) { categoryId source count } }`;

/** The category the user's own patterns suggest (no AI), or null. */
export async function similarCategory(
  id: string,
  run: GqlRunner,
): Promise<SimilarCategory | null> {
  const data = await run<{ similarCategory: SimilarCategory | null }>(
    SIMILAR_CATEGORY_QUERY,
    { id },
  );
  return data.similarCategory ?? null;
}

export const SUGGEST_CATEGORY_AI_MUTATION = `mutation SuggestCategoryWithAi($id: ID!, $name: String) { suggestCategoryWithAi(transactionId: $id, name: $name) { categoryId aiUnavailable } }`;

/** The AI's category from a name (else the bank text) and the amount; not saved. */
export async function suggestCategoryWithAi(
  id: string,
  name: string | null,
  run: GqlRunner,
): Promise<{ categoryId: string | null; aiUnavailable: boolean }> {
  const data = await run<{
    suggestCategoryWithAi: {
      categoryId: string | null;
      aiUnavailable: boolean;
    };
  }>(SUGGEST_CATEGORY_AI_MUTATION, { id, name });
  return data.suggestCategoryWithAi;
}

export async function updateTransaction(
  id: string,
  input: UpdateTransactionPayload,
  run: GqlRunner,
): Promise<void> {
  await run(UPDATE_TRANSACTION_MUTATION, { id, input });
}

export async function deleteTransaction(
  id: string,
  run: GqlRunner,
): Promise<void> {
  await run(DELETE_TRANSACTION_MUTATION, { id });
}

export async function removeAttachment(
  id: string,
  run: GqlRunner,
): Promise<void> {
  await run(REMOVE_ATTACHMENT_MUTATION, { id });
}

/** API messages are English; show ours in the user's language. */
const MESSAGES: [RegExp, Parameters<Translate>[0]][] = [
  [/part of a transfer|amount of a transfer/i, 'transaction.errors.transfer'],
  [/debt payment/i, 'transaction.errors.debtPayment'],
  [/goal contribution/i, 'transaction.errors.goal'],
  [/imported transactions/i, 'transaction.errors.imported'],
  [/category not found/i, 'transaction.errors.category'],
  [/attachment not found/i, 'transaction.errors.attachmentNotFound'],
  [/transaction not found/i, 'transaction.errors.notFound'],
];

export function transactionErrorMessage(error: unknown, t: Translate): string {
  const message = (error as { message?: string } | null)?.message ?? '';
  const known = MESSAGES.find(([pattern]) => pattern.test(message));
  if (known) return t(known[1]);
  const code = (error as { code?: string } | null)?.code;
  if (code === 'INTERNAL_SERVER_ERROR') return t('errors.unexpected');
  return requestErrorMessage(error, t);
}
