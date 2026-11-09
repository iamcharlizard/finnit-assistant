import type { GqlRunner } from '@finnit/core/graphql/request';
import { requestErrorMessage } from '@finnit/core/graphql/request';
import type { Translate } from '@finnit/core/i18n/translator';
import type { UpdateTransactionPayload } from '@finnit/core/transaction-detail/form';
import type { SimilarCategory } from '@finnit/core/transaction-detail/types';

/** The detail's mutations, run from client components through /api/graphql. */

export const UPDATE_TRANSACTION_MUTATION = `mutation UpdateTransaction($id: String!, $input: UpdateTransactionInput!) { updateTransaction(id: $id, input: $input) { id } }`;

export const SET_ALIAS_MUTATION = `mutation SetTransactionAlias($id: ID!, $input: TransactionAliasInput!) { setTransactionAlias(id: $id, input: $input) { id } }`;

export const DELETE_TRANSACTION_MUTATION = `mutation DeleteTransaction($id: String!) { deleteTransaction(id: $id) }`;

export const DELETE_TRANSFER_MUTATION = `mutation DeleteTransfer($transferId: ID!) { deleteTransfer(transferId: $transferId) }`;

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

/** Deletes a whole transfer (from the history's transfer group). */
export async function deleteTransfer(
  transferId: string,
  run: GqlRunner,
): Promise<void> {
  await run(DELETE_TRANSFER_MUTATION, { transferId });
}

export async function removeAttachment(
  id: string,
  run: GqlRunner,
): Promise<void> {
  await run(REMOVE_ATTACHMENT_MUTATION, { id });
}

/** API messages are English; show ours in the user's language. */
const MESSAGES: [RegExp, Parameters<Translate>[0]][] = [
  [/money of a loan/i, 'transaction.errors.loanMoney'],
  [/both movements came from the bank/i, 'duplicates.errors.bothBank'],
  [/only the same amount/i, 'duplicates.errors.notSame'],
  [/already in a transfer/i, 'duplicates.errors.bothTransfer'],
  [/already pay a loan/i, 'duplicates.errors.bothLoan'],
  [/already pay a recurring/i, 'duplicates.errors.bothRecurring'],
  [/cannot be merged/i, 'duplicates.errors.notMergeable'],
  [
    /doesn't match this side|already linked/i,
    'newEntry.transferLegs.errors.mismatch',
  ],
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
