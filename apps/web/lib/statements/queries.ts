import { STATEMENT_IMPORT_FIELDS, type StatementAccount } from './types';
import type { StatementListItem } from './view';

/** The list of uploaded statements, a page at a time. */
export const STATEMENTS_PAGE_SIZE = 20;

export const STATEMENTS_QUERY = `query StatementImports($first: Int!, $after: String) {
  statementImports(first: $first, after: $after) {
    totalCount
    edges { node { ${STATEMENT_IMPORT_FIELDS} } }
    pageInfo { endCursor hasNextPage }
  }
}`;

export interface StatementsData {
  items: StatementListItem[];
  totalCount: number;
  endCursor: string | null;
  hasNextPage: boolean;
  /** Credit cards for the upload form. */
  cards: { value: string; label: string }[];
  /** All accounts, to name the ones in later pages. */
  accounts: StatementAccount[];
}
