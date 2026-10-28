import {
  TRANSACTION_FIELDS,
  type ApiTransaction,
  type CategorySource,
} from '@/lib/finance/types';

/**
 * A transaction as "Clasificar movimientos" reads it: the list fields plus
 * how its category was set and the AI's pending suggestion.
 */
export interface CategorizeTransaction extends ApiTransaction {
  categorySource?: CategorySource | null;
  /** The AI's suggestion, pending until accepted or rejected. */
  suggestedCategory?: {
    id: string;
    name: string;
    parentId: string | null;
  } | null;
  /** The bank's text; null for private ones in lists. */
  originalDescription?: string | null;
}

export const CATEGORIZE_FIELDS = `${TRANSACTION_FIELDS} categorySource suggestedCategory { id name parentId } originalDescription`;

/** A category as the "Mover a…" picker needs it (key orders the income group). */
export interface CategorizeCategory {
  id: string;
  name: string;
  parentId: string | null;
  key: string | null;
}

/** The first page and its cursor (plain data, sent from the server). */
export interface CategorizePageData {
  transactions: CategorizeTransaction[];
  totalCount: number;
  endCursor: string | null;
  hasNextPage: boolean;
}
