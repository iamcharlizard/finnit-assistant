import {
  TRANSACTION_FIELDS,
  type ApiTransaction,
  type Connection,
} from '../finance/types';
import type { EntryAccount } from '../new-entry/graphql';

/**
 * Turning an expense or income into a transfer between the user's own
 * accounts: pick the other account and, when that account already has the
 * opposite movement (same amount, a few days apart), link it instead of
 * creating one.
 */

export const CONVERT_DATA_QUERY = `query ConvertToTransferData($id: ID!) {
  accounts(first: 100, archived: false) { edges { node { id name type currency balanceCurrent archived metadata { nickname bank last4 } } } }
  transferCandidates(transactionId: $id) { ${TRANSACTION_FIELDS} }
}`;

export interface ConvertData {
  accounts: Connection<EntryAccount>;
  transferCandidates: ApiTransaction[];
}

export const CONVERT_TO_TRANSFER_MUTATION = `mutation ConvertToTransfer($input: ConvertToTransferInput!) { convertToTransfer(input: $input) { id } }`;

export const UNDO_TRANSFER_CONVERSION_MUTATION = `mutation UndoTransferConversion($transferId: ID!) { undoTransferConversion(transferId: $transferId) }`;

/** The movement being converted, as both screens know it. */
export interface ConvertSource {
  id: string;
  type: string;
  accountId: string;
  currency: string;
  amount: number;
}

/** Only expenses and income become transfers. */
export function canConvertToTransfer(tx: { type: string }): boolean {
  return tx.type === 'expense' || tx.type === 'income';
}

/** Money leaving (an expense) or arriving (an income). */
export function convertDirection(tx: { type: string }): 'out' | 'in' {
  return tx.type === 'income' ? 'in' : 'out';
}

/** The other accounts it can go to: same currency, not archived. */
export function convertTargets(
  accounts: ReadonlyArray<EntryAccount>,
  source: ConvertSource,
): EntryAccount[] {
  return accounts.filter(
    (account) =>
      !account.archived &&
      account.id !== source.accountId &&
      account.currency === source.currency,
  );
}

/** The candidates recorded in one account (the API ranks them). */
export function candidatesIn(
  candidates: ReadonlyArray<ApiTransaction>,
  accountId: string | null,
): ApiTransaction[] {
  return accountId
    ? candidates.filter((candidate) => candidate.accountId === accountId)
    : [];
}

/**
 * Where the dialog starts: the account of the best candidate, with it
 * chosen; with no candidates, nothing chosen yet.
 */
export function initialConvertChoice(
  candidates: ReadonlyArray<ApiTransaction>,
  targets: ReadonlyArray<EntryAccount>,
): { accountId: string | null; candidateId: string | null } {
  const allowed = new Set(targets.map((account) => account.id));
  const best = candidates.find((candidate) => allowed.has(candidate.accountId));
  return best
    ? { accountId: best.accountId, candidateId: best.id }
    : { accountId: null, candidateId: null };
}

/** convertToTransfer's input. */
export function convertInput(
  source: ConvertSource,
  accountId: string,
  candidateId: string | null,
): {
  transactionId: string;
  counterpartAccountId: string;
  counterpartTransactionId: string | null;
} {
  return {
    transactionId: source.id,
    counterpartAccountId: accountId,
    counterpartTransactionId: candidateId,
  };
}
