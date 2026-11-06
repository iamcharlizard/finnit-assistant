
import {
  GraphqlRequestError,
  NETWORK_ERROR,
  requestErrorMessage,
} from '@finnit/core/graphql/request';

export { GraphqlRequestError, NETWORK_ERROR, requestErrorMessage };

/**
 * GraphQL from client components. Goes through this site's /api/graphql,
 * which adds the session token server-side (the browser never holds it).
 */
export async function gql<T>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch('/api/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    throw new GraphqlRequestError('Finnit is unreachable', NETWORK_ERROR);
  }

  if (response.status === 401) {
    // Session ended (e.g. refresh token expired): back to login, then here.
    window.location.assign(
      `/login?next=${encodeURIComponent(window.location.pathname)}`,
    );
    throw new GraphqlRequestError('Session ended', 'UNAUTHENTICATED');
  }

  const json = (await response.json().catch(() => null)) as {
    data?: T;
    errors?: { message: string; extensions?: { code?: string } }[];
  } | null;
  const error = json?.errors?.[0];
  if (error || !json?.data) {
    throw new GraphqlRequestError(
      error?.message ?? 'Unexpected response',
      error?.extensions?.code,
      Boolean(error?.message),
    );
  }
  return json.data;
}
