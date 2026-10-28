import type { GqlRunner } from '@/lib/accounts/api';
import { requestErrorMessage } from '@/lib/graphql/client';
import type { Translate } from '@/lib/i18n/translator';
import {
  STATEMENT_DETAIL_FIELDS,
  STATEMENT_LINE_FIELDS,
  type ApiStatementDetail,
  type ApiStatementLine,
} from './types';

/** Statement queries and mutations from client components (/api/graphql). */

export const STATEMENT_QUERY = `query StatementImport($id: ID!) { statementImport(id: $id) { ${STATEMENT_DETAIL_FIELDS} } }`;

export const UPDATE_LINE_MUTATION = `mutation UpdateStatementLine($id: ID!, $input: UpdateStatementLineInput!) { updateStatementLine(id: $id, input: $input) { ${STATEMENT_LINE_FIELDS} } }`;

export const CONFIRM_MUTATION = `mutation ConfirmStatementImport($id: ID!) { confirmStatementImport(id: $id) { ${STATEMENT_DETAIL_FIELDS} } }`;

export const REPROCESS_MUTATION = `mutation ReprocessStatementImport($id: ID!, $parser: String) { reprocessStatementImport(id: $id, parser: $parser) { ${STATEMENT_DETAIL_FIELDS} } }`;

export const DELETE_MUTATION = `mutation DeleteStatementImport($id: ID!) { deleteStatementImport(id: $id) }`;

/** Candidates to link a line to: same card, amount within a cent, ±3 days. */
export const SIMILAR_QUERY = `query StatementLineCandidates($accountId: ID!, $amount: Float!, $date: DateTime!, $type: TransactionType) {
  similarTransactions(accountId: $accountId, amount: $amount, date: $date, type: $type) { id type amount currency txnDate displayName isPrivate }
}`;

export interface LinkCandidate {
  id: string;
  type: string;
  amount: number;
  currency: string;
  txnDate: string;
  displayName: string;
  isPrivate: boolean;
}

/** Parsers to reprocess with: automatic (registry's choice), Banamex, AI. */
export const REPROCESS_PARSERS = ['auto', 'banamex_v1', 'ai'] as const;
export type ReprocessParser = (typeof REPROCESS_PARSERS)[number];

export type LineChange =
  | { status: 'pending' | 'ignored' }
  | { categoryId: string | null }
  | { matchedTransactionId: string | null };

export async function fetchStatement(
  id: string,
  run: GqlRunner,
): Promise<ApiStatementDetail> {
  const data = await run<{ statementImport: ApiStatementDetail }>(
    STATEMENT_QUERY,
    { id },
  );
  return data.statementImport;
}

export async function updateLine(
  id: string,
  input: LineChange,
  run: GqlRunner,
): Promise<ApiStatementLine> {
  const data = await run<{ updateStatementLine: ApiStatementLine }>(
    UPDATE_LINE_MUTATION,
    { id, input },
  );
  return data.updateStatementLine;
}

export async function confirmStatement(
  id: string,
  run: GqlRunner,
): Promise<ApiStatementDetail> {
  const data = await run<{ confirmStatementImport: ApiStatementDetail }>(
    CONFIRM_MUTATION,
    { id },
  );
  return data.confirmStatementImport;
}

export async function reprocessStatement(
  id: string,
  parser: ReprocessParser,
  run: GqlRunner,
): Promise<ApiStatementDetail> {
  const data = await run<{ reprocessStatementImport: ApiStatementDetail }>(
    REPROCESS_MUTATION,
    { id, parser: parser === 'auto' ? null : parser },
  );
  return data.reprocessStatementImport;
}

export async function deleteStatement(
  id: string,
  run: GqlRunner,
): Promise<void> {
  await run(DELETE_MUTATION, { id });
}

/**
 * similarTransactions' arguments for a line: charges look for expenses,
 * payments and refunds for any type (they are adjustments or transfers).
 */
export function candidateArgs(
  accountId: string,
  line: { rawAmount: number; day: string; variant: 'income' | 'expense' },
): Record<string, unknown> {
  return {
    accountId,
    amount: line.rawAmount,
    date: `${line.day}T12:00:00.000Z`,
    type: line.variant === 'expense' ? 'expense' : null,
  };
}

export async function findCandidates(
  accountId: string,
  line: { rawAmount: number; day: string; variant: 'income' | 'expense' },
  run: GqlRunner,
): Promise<LinkCandidate[]> {
  const data = await run<{ similarTransactions: LinkCandidate[] }>(
    SIMILAR_QUERY,
    candidateArgs(accountId, line),
  );
  return data.similarTransactions;
}

/** API messages are English; show ours in the user's language. */
const MESSAGES: [RegExp, Parameters<Translate>[0]][] = [
  [/already linked/i, 'statements.errors.alreadyLinked'],
  [/not found on this card/i, 'statements.errors.notOnCard'],
  [/only statements in review/i, 'statements.errors.notInReview'],
  [
    /confirmed statement cannot be deleted/i,
    'statements.errors.confirmedDelete',
  ],
  [
    /confirmed statement cannot be reprocessed/i,
    'statements.errors.confirmedReprocess',
  ],
  [
    /already being processed|finishes processing/i,
    'statements.errors.processing',
  ],
  [/recurring payment is already paid/i, 'statements.errors.recurringPaid'],
  [/category not found/i, 'statements.errors.category'],
  [/statement not found|line not found/i, 'statements.errors.notFound'],
];

export function statementErrorMessage(error: unknown, t: Translate): string {
  const message = (error as { message?: string } | null)?.message ?? '';
  const known = MESSAGES.find(([pattern]) => pattern.test(message));
  if (known) return t(known[1]);
  const code = (error as { code?: string } | null)?.code;
  if (code === 'INTERNAL_SERVER_ERROR') return t('errors.unexpected');
  return requestErrorMessage(error, t);
}
