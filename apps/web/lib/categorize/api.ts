import type { GqlRunner } from '@/lib/accounts/api';
import type { Connection } from '@/lib/finance/types';
import { requestErrorMessage } from '@/lib/graphql/client';
import type { Translate } from '@/lib/i18n/translator';
import { pageVariables, type CategorizeFilters } from './filters';
import { renameInput, type RenameForm } from './rename';
import { categorizeBatches } from './selection';
import {
  CATEGORIZE_FIELDS,
  type CategorizePageData,
  type CategorizeTransaction,
} from './types';

/** "Clasificar movimientos" GraphQL, run from client components through /api/graphql. */

export const CATEGORIZE_CONNECTION = `transactions(first: $first, after: $after, filters: $filters) {
    totalCount
    edges { node { ${CATEGORIZE_FIELDS} } }
    pageInfo { endCursor hasNextPage }
  }`;

export const CATEGORIZE_PAGE_QUERY = `query CategorizePage($first: Int!, $after: String, $filters: TransactionFilters) {
  ${CATEGORIZE_CONNECTION}
}`;

export const CATEGORIZE_MUTATION = `mutation CategorizeTransactions($ids: [ID!]!, $categoryId: ID!, $createRule: Boolean!) { categorizeTransactions(ids: $ids, categoryId: $categoryId, createRule: $createRule) }`;

export const SUGGEST_MUTATION = `mutation SuggestTransactionCategories($ids: [ID!]!) { suggestTransactionCategories(ids: $ids) { ${CATEGORIZE_FIELDS} } }`;

export const ACCEPT_MUTATION = `mutation AcceptCategorySuggestions($ids: [ID!]!) { acceptCategorySuggestions(ids: $ids) }`;

export const REJECT_MUTATION = `mutation RejectCategorySuggestions($ids: [ID!]!) { rejectCategorySuggestions(ids: $ids) }`;

export const SET_ALIAS_MUTATION = `mutation SetTransactionAlias($id: ID!, $input: TransactionAliasInput!) { setTransactionAlias(id: $id, input: $input) { ${CATEGORIZE_FIELDS} } }`;

export function toPageData(
  connection: Connection<CategorizeTransaction>,
): CategorizePageData {
  return {
    transactions: connection.edges.map((e) => e.node),
    totalCount: connection.totalCount,
    endCursor: connection.pageInfo.endCursor,
    hasNextPage: connection.pageInfo.hasNextPage,
  };
}

/** The next page after `after`, or (without it) the first `loaded` rows again. */
export async function fetchPage(
  filters: CategorizeFilters,
  options: { after?: string | null; loaded?: number },
  run: GqlRunner,
): Promise<CategorizePageData> {
  const data = await run<{ transactions: Connection<CategorizeTransaction> }>(
    CATEGORIZE_PAGE_QUERY,
    pageVariables(filters, options),
  );
  return toPageData(data.transactions);
}

/** Moves the ids to a category (in batches); returns how many changed. */
export async function categorize(
  ids: ReadonlyArray<string>,
  categoryId: string,
  createRule: boolean,
  run: GqlRunner,
): Promise<number> {
  let changed = 0;
  for (const batch of categorizeBatches(ids, categoryId, createRule)) {
    const data = await run<{ categorizeTransactions: number }>(
      CATEGORIZE_MUTATION,
      { ...batch },
    );
    changed += data.categorizeTransactions;
  }
  return changed;
}

/** Asks the AI for suggestions; slow (seconds), may return none. */
export async function suggestCategories(
  ids: ReadonlyArray<string>,
  run: GqlRunner,
): Promise<CategorizeTransaction[]> {
  if (ids.length === 0) return [];
  const data = await run<{
    suggestTransactionCategories: CategorizeTransaction[];
  }>(SUGGEST_MUTATION, { ids });
  return data.suggestTransactionCategories ?? [];
}

export async function reviewSuggestions(
  action: 'accept' | 'reject',
  ids: ReadonlyArray<string>,
  run: GqlRunner,
): Promise<number> {
  if (ids.length === 0) return 0;
  if (action === 'accept') {
    const data = await run<{ acceptCategorySuggestions: number }>(
      ACCEPT_MUTATION,
      { ids },
    );
    return data.acceptCategorySuggestions;
  }
  const data = await run<{ rejectCategorySuggestions: number }>(
    REJECT_MUTATION,
    { ids },
  );
  return data.rejectCategorySuggestions;
}

export async function renameTransaction(
  id: string,
  form: RenameForm | 'remove',
  run: GqlRunner,
): Promise<CategorizeTransaction> {
  const data = await run<{ setTransactionAlias: CategorizeTransaction }>(
    SET_ALIAS_MUTATION,
    { id, input: renameInput(form) },
  );
  return data.setTransactionAlias;
}

/** API messages are English; show ours in the user's language. */
const MESSAGES: [RegExp, Parameters<Translate>[0]][] = [
  [/at most \d+|too many/i, 'categorize.errors.tooMany'],
  [/category not found/i, 'categorize.errors.category'],
  [/transaction.* not found/i, 'categorize.errors.notFound'],
];

export function categorizeErrorMessage(error: unknown, t: Translate): string {
  const message = (error as { message?: string } | null)?.message ?? '';
  const known = MESSAGES.find(([pattern]) => pattern.test(message));
  if (known) return t(known[1]);
  const code = (error as { code?: string } | null)?.code;
  if (code === 'INTERNAL_SERVER_ERROR') return t('errors.unexpected');
  return requestErrorMessage(error, t);
}
