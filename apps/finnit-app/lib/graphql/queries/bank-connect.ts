/** Queries used by the "Conectar banco" flow and the settings screen. */

export const FINNIT_ACCOUNTS_QUERY = `
  query FinnitAccounts {
    accounts(first: 100) {
      edges {
        node { id name type }
      }
    }
  }
`;

export const BANK_CONNECTIONS_QUERY = `
  query BankConnections {
    bankConnections {
      id
      institution
      status
      lastSyncedAt
      accounts { id }
    }
  }
`;

export type FinnitAccountType = 'cash' | 'credit' | 'debit' | 'ewallet' | 'savings';

export type FinnitAccount = {
  id: string;
  name: string;
  type: FinnitAccountType;
};

export type FinnitAccountsResult = {
  accounts: { edges: { node: FinnitAccount }[] };
};

export type BankConnectionStatus = 'active' | 'error' | 'revoked';

export type BankConnectionSummary = {
  id: string;
  institution: string | null;
  status: BankConnectionStatus;
  lastSyncedAt: string | null;
  accounts: { id: string }[];
};

export type BankConnectionsResult = {
  bankConnections: BankConnectionSummary[];
};
