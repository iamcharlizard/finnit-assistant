import type { Translate } from '@/lib/i18n/translator';

/**
 * GraphQL from client components. Goes through this site's /api/graphql,
 * which adds the session token server-side (the browser never holds it).
 */
export class GraphqlRequestError extends Error {
  constructor(
    message: string,
    /** The API's GraphQL error code, or NETWORK_ERROR / UNAUTHENTICATED. */
    readonly code?: string,
    /** True when `message` is the API's own text (not one made up here). */
    readonly fromApi = false,
  ) {
    super(message);
    this.name = 'GraphqlRequestError';
  }
}

export const NETWORK_ERROR = 'NETWORK_ERROR';

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

/**
 * Text to show for a failed request: connection and session problems in
 * the user's language, otherwise the API's message (or a generic one).
 */
export function requestErrorMessage(error: unknown, t: Translate): string {
  if (error instanceof GraphqlRequestError) {
    if (error.code === NETWORK_ERROR) return t('errors.network');
    if (error.code === 'UNAUTHENTICATED') return t('errors.sessionEnded');
    if (error.fromApi && error.message) return error.message;
  }
  return t('errors.unexpected');
}
