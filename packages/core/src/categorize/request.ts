/** Clasificar's first-page request, shared by the web loader and the mobile app. */
import type { Connection } from '../finance/types';
import type { EntryAccount } from '../new-entry/graphql';
import { TRANSFER_SUGGESTIONS_FIELDS, type ApiTransferSuggestion } from '../transfers/suggestions';
import { CATEGORIZE_CONNECTION } from './api';
import type { CategorizeCategory, CategorizeTransaction } from './types';

export const CATEGORIZE_QUERY = `query Categorize($first: Int!, $after: String, $filters: TransactionFilters) {
  ${CATEGORIZE_CONNECTION}
  accounts(first: 100) { edges { node { id name type currency balanceCurrent archived metadata { nickname bank last4 } } } }
  categories { id name parentId key kind icon }
  ${TRANSFER_SUGGESTIONS_FIELDS}
}`;

export interface CategorizeResult {
  transactions: Connection<CategorizeTransaction>;
  accounts: Connection<EntryAccount>;
  categories: CategorizeCategory[];
  transferSuggestions: Connection<ApiTransferSuggestion>;
}
