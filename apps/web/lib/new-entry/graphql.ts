import type { AccountType, Connection } from '@/lib/finance/types';

/**
 * GraphQL for the "Nuevo movimiento" flow (the "+" button). Sent from the
 * browser through /api/graphql (lib/graphql/client.ts).
 */

/** An account as the create flow needs it. */
export interface EntryAccount {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
  /** Credit cards: negative is what is owed. */
  balanceCurrent: number;
  archived: boolean;
  metadata: {
    nickname?: string | null;
    bank?: string | null;
    last4?: string | null;
  } | null;
}

export interface EntryCategory {
  id: string;
  name: string;
  parentId: string | null;
  /** i18n key of a default category (e.g. 'categories.income.salary'). */
  key: string | null;
}

export const NEW_ENTRY_DATA_QUERY = `query NewEntryData {
  accounts(first: 100, archived: false) { edges { node { id name type currency balanceCurrent archived metadata { nickname bank last4 } } } }
  categories { id name parentId key }
}`;

export interface NewEntryData {
  accounts: Connection<EntryAccount>;
  categories: EntryCategory[];
}

/** A possible duplicate of the transaction about to be created. */
export interface SimilarTransaction {
  id: string;
  type: string;
  amount: number;
  currency: string;
  txnDate: string;
  description: string | null;
  merchantName: string | null;
}

export const SIMILAR_TRANSACTIONS_QUERY = `query SimilarTransactions($accountId: ID!, $amount: Float!, $date: DateTime!, $type: TransactionType) {
  similarTransactions(accountId: $accountId, amount: $amount, date: $date, type: $type) { id type amount currency txnDate description merchantName }
}`;

export const SUGGEST_CATEGORY_QUERY = `query SuggestCategory($input: SuggestCategoryInput!) {
  suggestCategoryForMerchant(input: $input) { id }
}`;

export const CREATE_TRANSACTION_MUTATION = `mutation CreateTransaction($input: CreateTransactionInput!) {
  createTransaction(input: $input) { id }
}`;

export const CREATE_TRANSFER_MUTATION = `mutation CreateTransfer($input: CreateTransferInput!) {
  createTransfer(input: $input) { id }
}`;
