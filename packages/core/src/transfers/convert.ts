import {
  TRANSACTION_FIELDS,
  type ApiTransaction,
  type Connection,
} from '../finance/types';
import { daysBetween, dayKeyOf } from '../finance/dates';
import type { EntryAccount } from '../new-entry/graphql';

/**
 * Turning an expense or income into a transfer between the user's own
 * accounts: pick the other account and, when that account already has the
 * opposite movement (the same amount, not linked to anything yet), link it
 * instead of creating one. The API offers those of any date, closest first;
 * only one within a week is chosen for the user.
 */

/**
 * How far apart the two sides may land and still be proposed: a payment
 * can take a few days to show on the other account, above all over a
 * weekend. Mirrors the API's TRANSFER_DAYS_WINDOW.
 */
export const NEAR_TRANSFER_DAYS = 7;

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
  /** When it happened: candidates close to it are proposed. */
  txnDate: string;
}

/** Whether a candidate landed close enough to propose it. */
export function isNearCandidate(
  source: Pick<ConvertSource, 'txnDate'>,
  candidate: Pick<ApiTransaction, 'txnDate'>,
): boolean {
  return (
    Math.abs(
      daysBetween(dayKeyOf(source.txnDate), dayKeyOf(candidate.txnDate)),
    ) <= NEAR_TRANSFER_DAYS
  );
}

/** The candidate to choose in an account: its closest, if near enough. */
export function proposedCandidate(
  candidates: ReadonlyArray<ApiTransaction>,
  accountId: string | null,
  source: Pick<ConvertSource, 'txnDate'>,
): string | null {
  const first = candidatesIn(candidates, accountId)[0];
  return first && isNearCandidate(source, first) ? first.id : null;
}

/** Only expenses and income become transfers. */
export function canConvertToTransfer(tx: { type: string }): boolean {
  return tx.type === 'expense' || tx.type === 'income';
}

/** Money leaving (an expense) or arriving (an income). */
export function convertDirection(tx: { type: string }): 'out' | 'in' {
  return tx.type === 'income' ? 'in' : 'out';
}

/**
 * What the dialog records: a transfer between own accounts, or a payment
 * of a credit card ("Registrar como pago a tarjeta de crédito"), which is a
 * transfer into the card.
 */
export type ConvertMode = 'transfer' | 'cardPayment';

/**
 * The other accounts it can go to: same currency, not archived. Paying a
 * card with an expense, only credit cards; a payment received on a card
 * (income) comes from any other account, like a transfer.
 */
export function convertTargets(
  accounts: ReadonlyArray<EntryAccount>,
  source: ConvertSource,
  mode: ConvertMode = 'transfer',
): EntryAccount[] {
  return accounts.filter(
    (account) =>
      !account.archived &&
      account.id !== source.accountId &&
      account.currency === source.currency &&
      (mode !== 'cardPayment' ||
        convertDirection(source) === 'in' ||
        account.type === 'credit'),
  );
}

/**
 * Whether "Registrar como pago a tarjeta de crédito" applies: an expense
 * when the user has a credit card other than its account, or an income
 * received on a credit card (the payment as the card sees it).
 */
export function canRecordCardPayment(
  source: Pick<ConvertSource, 'type' | 'accountId'>,
  accountType: string | null | undefined,
  creditCardIds: ReadonlyArray<string>,
): boolean {
  if (!canConvertToTransfer(source)) return false;
  return convertDirection(source) === 'out'
    ? creditCardIds.some((id) => id !== source.accountId)
    : accountType === 'credit';
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
 * Where the dialog starts: the account of the best candidate within a week,
 * with it chosen; otherwise nothing chosen yet (farther ones show once the
 * user picks their account).
 */
export function initialConvertChoice(
  candidates: ReadonlyArray<ApiTransaction>,
  targets: ReadonlyArray<EntryAccount>,
  source: Pick<ConvertSource, 'txnDate'>,
): { accountId: string | null; candidateId: string | null } {
  const allowed = new Set(targets.map((account) => account.id));
  const best = candidates.find(
    (candidate) =>
      allowed.has(candidate.accountId) && isNearCandidate(source, candidate),
  );
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
