/**
 * "Marcar como duplicado" and the "Posibles duplicados" panel: queries and
 * mutations shared by the web and the app (each runs them with its client).
 */
import type { GqlRunner } from '../graphql/request';
import { TRANSACTION_FIELDS, type ApiTransaction } from '../finance/types';

export type MergeNameFrom = 'keep' | 'drop';

export const DUPLICATE_CANDIDATES_QUERY = `query DuplicateCandidates($transactionId: ID!) {
  duplicateCandidates(transactionId: $transactionId) { ${TRANSACTION_FIELDS} }
}`;

export const MERGE_TRANSACTIONS_MUTATION = `mutation MergeTransactions($input: MergeTransactionsInput!) {
  mergeTransactions(input: $input) { id }
}`;

export const DUPLICATE_SUGGESTIONS_QUERY = `query DuplicateSuggestions($first: Int) {
  duplicateSuggestions(first: $first) {
    totalCount
    edges { node { id createdAt keep { ${TRANSACTION_FIELDS} } drop { ${TRANSACTION_FIELDS} } } }
  }
}`;

export const RESOLVE_DUPLICATE_MUTATION = `mutation ResolveDuplicateSuggestion($input: ResolveDuplicateSuggestionInput!) {
  resolveDuplicateSuggestion(input: $input)
}`;

export interface ApiDuplicateSuggestion {
  id: string;
  createdAt: string;
  keep: ApiTransaction;
  drop: ApiTransaction;
}

export interface DuplicateSuggestionsResult {
  duplicateSuggestions: {
    totalCount: number;
    edges: { node: ApiDuplicateSuggestion }[];
  };
}

export async function duplicateCandidates(
  transactionId: string,
  run: GqlRunner,
): Promise<ApiTransaction[]> {
  const data = await run<{ duplicateCandidates: ApiTransaction[] }>(
    DUPLICATE_CANDIDATES_QUERY,
    { transactionId },
  );
  return data.duplicateCandidates;
}

/** Merges the pair; returns the id of the movement that stays. */
export async function mergeTransactions(
  input: {
    keepId: string;
    dropId: string;
    nameFrom: MergeNameFrom;
  },
  run: GqlRunner,
): Promise<string> {
  const data = await run<{ mergeTransactions: { id: string } }>(
    MERGE_TRANSACTIONS_MUTATION,
    {
      input: {
        transactionId: input.keepId,
        duplicateId: input.dropId,
        keepId: input.keepId,
        nameFrom: input.nameFrom,
      },
    },
  );
  return data.mergeTransactions.id;
}

export async function resolveDuplicate(
  input: { id: string; action: 'merge' | 'dismiss'; nameFrom?: MergeNameFrom },
  run: GqlRunner,
): Promise<void> {
  await run(RESOLVE_DUPLICATE_MUTATION, {
    input: { nameFrom: 'keep', ...input },
  });
}
