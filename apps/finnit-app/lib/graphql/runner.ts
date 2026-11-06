import * as React from 'react';
import { useClient, type CombinedError } from 'urql';

import { GraphqlRequestError, NETWORK_ERROR, type GqlRunner } from '@finnit/core/graphql/request';

/** urql's error as the shared GraphqlRequestError (what core's api.ts expect). */
export function toRequestError(error: CombinedError): GraphqlRequestError {
  if (error.networkError) return new GraphqlRequestError(error.networkError.message, NETWORK_ERROR);
  const first = error.graphQLErrors[0];
  return new GraphqlRequestError(
    first?.message ?? error.message,
    first?.extensions?.code as string | undefined,
    Boolean(first?.message),
  );
}

/**
 * The mobile runner for @finnit/core's api.ts modules (the web's `gql`):
 * runs a document through the app's urql client (mutations or one-off
 * queries) and returns its data, or throws GraphqlRequestError.
 */
export function useGql(): GqlRunner {
  const client = useClient();
  return React.useCallback<GqlRunner>(
    async <T,>(query: string, variables: Record<string, unknown> = {}) => {
      const isQuery = /^\s*query\b/.test(query);
      const result = await (isQuery
        ? client.query<T>(query, variables, { requestPolicy: 'network-only' })
        : client.mutation<T>(query, variables)
      ).toPromise();
      if (result.error) throw toRequestError(result.error);
      if (!result.data) throw new GraphqlRequestError('Unexpected response');
      return result.data;
    },
    [client],
  ) as GqlRunner;
}
