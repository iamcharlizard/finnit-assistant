/**
 * Finnit API mutations used by the "Conectar banco" flow.
 * Bank logins never go through these: they go from the device to Syncfy
 * (see @finnit/bank-connect). These only exchange a short-lived session,
 * the resulting credential id and how each account is imported.
 */

const LINKED_ACCOUNT_FIELDS = 'id name mask type currency balance accountId';

export const CREATE_BANK_CONNECT_SESSION_MUTATION = `
  mutation CreateBankConnectSession {
    createBankConnectSession {
      token
      widgetScriptUrl
      widgetStylesheetUrl
    }
  }
`;

export const REGISTER_BANK_CONNECTION_MUTATION = `
  mutation RegisterBankConnection($id: String!) {
    registerBankConnection(idCredential: $id) {
      connection {
        id
        institution
        accounts { ${LINKED_ACCOUNT_FIELDS} }
      }
    }
  }
`;

export const LINK_BANK_ACCOUNT_MUTATION = `
  mutation LinkBankAccount($id: ID!, $input: LinkBankAccountInput!) {
    linkBankAccount(linkedAccountId: $id, input: $input) {
      imported
      created
      connection { id }
    }
  }
`;

export type LinkedBankAccountData = {
  id: string;
  name: string | null;
  mask: string | null;
  type: string | null;
  currency: string | null;
  balance: number | null;
  accountId: string | null;
};

export type CreateBankConnectSessionResult = {
  createBankConnectSession: {
    token: string;
    widgetScriptUrl: string;
    widgetStylesheetUrl: string;
  };
};

export type RegisterBankConnectionResult = {
  registerBankConnection: {
    connection: {
      id: string;
      institution: string | null;
      accounts: LinkedBankAccountData[];
    };
  };
};

export type LinkBankAccountInput = {
  accountId?: string;
  createAccount?: boolean;
};

export type LinkBankAccountResult = {
  linkBankAccount: { imported: number; created: number };
};
