import 'server-only';

import { notFound } from 'next/navigation';

import { serverGraphql } from '@/lib/api/server-graphql';
import type { Connection } from '@/lib/finance/types';
import { isUuid } from '@/lib/files/routes';
import { getLocalizer } from '@/lib/i18n/server';
import {
  STATEMENT_ACCOUNT_FIELDS,
  STATEMENT_DETAIL_FIELDS,
  STATEMENT_IMPORT_FIELDS,
  type ApiStatementDetail,
  type ApiStatementImport,
  type StatementAccount,
  type StatementCategory,
} from './types';
import { STATEMENTS_PAGE_SIZE, type StatementsData } from './queries';
import {
  accountsById,
  toStatementListItem,
  uploadAccountOptions,
} from './view';

export async function loadStatements(): Promise<StatementsData> {
  const [data, l] = await Promise.all([
    serverGraphql<{
      statementImports: Connection<ApiStatementImport>;
      accounts: Connection<StatementAccount>;
    }>(
      `query Statements($first: Int!) {
        statementImports(first: $first) {
          totalCount
          edges { node { ${STATEMENT_IMPORT_FIELDS} } }
          pageInfo { endCursor hasNextPage }
        }
        accounts(first: 100) { edges { node { ${STATEMENT_ACCOUNT_FIELDS} } } }
      }`,
      { first: STATEMENTS_PAGE_SIZE },
    ),
    getLocalizer(),
  ]);
  const accounts = data.accounts.edges.map((e) => e.node);
  const byId = accountsById(accounts);
  return {
    items: data.statementImports.edges.map((e) =>
      toStatementListItem(e.node, byId, l),
    ),
    totalCount: data.statementImports.totalCount,
    endCursor: data.statementImports.pageInfo.endCursor,
    hasNextPage: data.statementImports.pageInfo.hasNextPage,
    cards: uploadAccountOptions(accounts),
    accounts,
  };
}

export interface StatementReviewData {
  statement: ApiStatementDetail;
  accounts: StatementAccount[];
  categories: StatementCategory[];
}

/** One statement with its lines; unknown or someone else's → 404. */
export async function loadStatement(id: string): Promise<StatementReviewData> {
  if (!isUuid(id)) notFound();
  const data = await serverGraphql<{
    statementImport: ApiStatementDetail;
    accounts: Connection<StatementAccount>;
    categories: StatementCategory[];
  }>(
    `query StatementReview($id: ID!) {
      statementImport(id: $id) { ${STATEMENT_DETAIL_FIELDS} }
      accounts(first: 100) { edges { node { ${STATEMENT_ACCOUNT_FIELDS} } } }
      categories { id name parentId key }
    }`,
    { id },
  ).catch((error: unknown) => {
    if (error instanceof Error && /not found/i.test(error.message)) notFound();
    throw error;
  });
  return {
    statement: data.statementImport,
    accounts: data.accounts.edges.map((e) => e.node),
    categories: data.categories,
  };
}
