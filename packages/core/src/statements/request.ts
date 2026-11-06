/** The statements screens' requests, shared by the web loader and the mobile app. */
import { STATEMENT_ACCOUNT_FIELDS, STATEMENT_DETAIL_FIELDS, STATEMENT_IMPORT_FIELDS } from './types';

export const STATEMENTS_QUERY = `query Statements($first: Int!) {
  statementImports(first: $first) {
    totalCount
    edges { node { ${STATEMENT_IMPORT_FIELDS} } }
    pageInfo { endCursor hasNextPage }
  }
  accounts(first: 100) { edges { node { ${STATEMENT_ACCOUNT_FIELDS} } } }
}`;

export const STATEMENT_REVIEW_QUERY = `query StatementReview($id: ID!) {
  statementImport(id: $id) { ${STATEMENT_DETAIL_FIELDS} }
  accounts(first: 100) { edges { node { ${STATEMENT_ACCOUNT_FIELDS} } } }
  categories { id name parentId key kind icon }
}`;
