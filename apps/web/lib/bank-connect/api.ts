import type { BankConnectApi, ConnectedBank } from '@finnit/bank-connect';

import { gql } from '@/lib/graphql/client';

const ACCOUNT_FIELDS = 'id name mask type currency balance accountId';

/** Finnit API calls of the bank connection flow, through /api/graphql. */
export const bankConnectApi: BankConnectApi = {
  async createSession() {
    const data = await gql<{
      createBankConnectSession: {
        token: string;
        widgetScriptUrl: string;
        widgetStylesheetUrl: string;
      };
    }>(
      'mutation BankConnectSession { createBankConnectSession { token widgetScriptUrl widgetStylesheetUrl } }',
    );
    return data.createBankConnectSession;
  },

  async registerConnection(idCredential) {
    const data = await gql<{
      registerBankConnection: { connection: ConnectedBank };
    }>(
      `mutation RegisterBank($id: String!) {
        registerBankConnection(idCredential: $id) {
          connection { id institution accounts { ${ACCOUNT_FIELDS} } }
        }
      }`,
      { id: idCredential },
    );
    return data.registerBankConnection.connection;
  },

  async linkAccount(linkedAccountId, input) {
    await gql(
      `mutation LinkBankAccount($id: ID!, $input: LinkBankAccountInput!) {
        linkBankAccount(linkedAccountId: $id, input: $input) { imported }
      }`,
      { id: linkedAccountId, input },
    );
  },
};

export interface FinnitAccount {
  id: string;
  name: string;
  type: 'cash' | 'credit' | 'debit' | 'ewallet' | 'savings';
}

/** The user's Finnit accounts, to link a bank account to an existing one. */
export async function fetchFinnitAccounts(): Promise<FinnitAccount[]> {
  const data = await gql<{
    accounts: { edges: { node: FinnitAccount }[] };
  }>(
    'query FinnitAccounts { accounts(first: 100) { edges { node { id name type } } } }',
  );
  return data.accounts.edges.map((edge) => edge.node);
}
