import type { BankConnectApi } from '@finnit/bank-connect';
import type { Client, CombinedError } from 'urql';

import { graphqlClient } from '@/lib/graphql/client';
import {
  CREATE_BANK_CONNECT_SESSION_MUTATION,
  LINK_BANK_ACCOUNT_MUTATION,
  REGISTER_BANK_CONNECTION_MUTATION,
  type CreateBankConnectSessionResult,
  type LinkBankAccountInput,
  type LinkBankAccountResult,
  type RegisterBankConnectionResult,
} from '@/lib/graphql/mutations/bank-connect';

function toError(error: CombinedError | undefined, fallback: string): Error {
  return new Error(error?.graphQLErrors[0]?.message ?? fallback);
}

/**
 * Finnit API calls of the bank connection flow, through the app's urql
 * client (Bearer token from SecureStore). Bank credentials never pass
 * through here: the flow sends them from the device straight to Syncfy.
 */
export function createBankConnectApi(client: Client = graphqlClient): BankConnectApi {
  return {
    async createSession() {
      const result = await client
        .mutation<CreateBankConnectSessionResult>(CREATE_BANK_CONNECT_SESSION_MUTATION, {})
        .toPromise();
      if (result.error || !result.data) {
        throw toError(result.error, 'No pudimos iniciar la conexión con tu banco.');
      }
      return result.data.createBankConnectSession;
    },

    async registerConnection(idCredential) {
      const result = await client
        .mutation<RegisterBankConnectionResult, { id: string }>(
          REGISTER_BANK_CONNECTION_MUTATION,
          { id: idCredential },
        )
        .toPromise();
      if (result.error || !result.data) {
        throw toError(result.error, 'No pudimos guardar la conexión en Finnit.');
      }
      const { id, institution, accounts } = result.data.registerBankConnection.connection;
      return { id, institution, accounts };
    },

    async linkAccount(linkedAccountId, input) {
      const result = await client
        .mutation<LinkBankAccountResult, { id: string; input: LinkBankAccountInput }>(
          LINK_BANK_ACCOUNT_MUTATION,
          { id: linkedAccountId, input },
        )
        .toPromise();
      if (result.error) {
        throw toError(result.error, 'No pudimos ligar la cuenta.');
      }
    },
  };
}
