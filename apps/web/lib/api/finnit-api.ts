import 'server-only';

import type { SessionTokens } from '@/lib/auth/cookies';

/**
 * Server-side access to the Finnit API. Only Next's server (server
 * components, server actions, route handlers and the proxy) talks to the
 * API; the browser goes through /api/graphql, so tokens never reach it.
 */
export function apiUrl(): string {
  const url =
    process.env.FINNIT_API_URL ??
    (process.env.NODE_ENV === 'production'
      ? undefined
      : 'http://localhost:3000');
  if (!url) throw new Error('FINNIT_API_URL is not set');
  return url.replace(/\/$/, '');
}

export interface GraphqlError {
  message: string;
  extensions?: { code?: string };
}

export interface GraphqlResponse<T> {
  data?: T | null;
  errors?: GraphqlError[];
}

export class ApiUnavailableError extends Error {}

export async function apiGraphql<T>(
  query: string,
  variables: Record<string, unknown> = {},
  accessToken?: string,
): Promise<GraphqlResponse<T>> {
  let response: Response;
  try {
    response = await fetch(`${apiUrl()}/graphql`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(accessToken && { authorization: `Bearer ${accessToken}` }),
      },
      body: JSON.stringify({ query, variables }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new ApiUnavailableError('The Finnit API is unreachable');
  }
  return (await response.json().catch(() => ({
    errors: [{ message: `HTTP ${response.status}` }],
  }))) as GraphqlResponse<T>;
}

export function isUnauthenticated(errors: GraphqlError[] | undefined): boolean {
  return Boolean(
    errors?.some(
      (e) =>
        e.extensions?.code === 'UNAUTHENTICATED' ||
        /unauthori[sz]ed/i.test(e.message),
    ),
  );
}

const AUTH_FIELDS = 'accessToken refreshToken user { id name email }';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export async function apiSignIn(
  email: string,
  password: string,
): Promise<(SessionTokens & { user: AuthUser }) | null> {
  const result = await apiGraphql<{
    signIn: SessionTokens & { user: AuthUser };
  }>(
    `mutation SignIn($input: SignInInput!) { signIn(input: $input) { ${AUTH_FIELDS} } }`,
    { input: { email, password } },
  );
  return result.data?.signIn ?? null;
}

export async function apiRefresh(
  refreshToken: string,
): Promise<SessionTokens | null> {
  const result = await apiGraphql<{ refreshToken: SessionTokens }>(
    `mutation Refresh($input: RefreshTokenInput!) { refreshToken(input: $input) { accessToken refreshToken } }`,
    { input: { refreshToken } },
  );
  return result.data?.refreshToken ?? null;
}
