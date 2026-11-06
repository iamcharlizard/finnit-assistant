import 'server-only';

import { headers as requestHeaders } from 'next/headers';

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

/** The visitor's IP as the hosting platform reports it (Vercel sets these). */
export function visitorIp(source: Headers): string | undefined {
  const forwarded = source.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || source.get('x-real-ip')?.trim() || undefined;
}

/**
 * Every API call comes from this server, so the API would rate-limit all
 * visitors as one. These headers tell it the visitor's IP; it trusts them
 * only with the shared FINNIT_BFF_SECRET. Outside a request (or without the
 * secret) nothing is added.
 */
async function clientIpHeaders(
  ip: string | undefined,
): Promise<Record<string, string>> {
  const secret = process.env.FINNIT_BFF_SECRET;
  if (!secret) return {};
  let address = ip;
  if (!address) {
    try {
      address = visitorIp(await requestHeaders());
    } catch {
      // Not inside a request (build time, scripts): nothing to forward.
    }
  }
  return address
    ? { 'x-finnit-client-ip': address, 'x-finnit-bff-secret': secret }
    : {};
}

export async function apiGraphql<T>(
  query: string,
  variables: Record<string, unknown> = {},
  accessToken?: string,
  headers: Record<string, string> = {},
  clientIp?: string,
): Promise<GraphqlResponse<T>> {
  let response: Response;
  const forwarded = await clientIpHeaders(clientIp);
  try {
    response = await fetch(`${apiUrl()}/graphql`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(accessToken && { authorization: `Bearer ${accessToken}` }),
        ...forwarded,
        ...headers,
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

const AUTH_FIELDS =
  'accessToken refreshToken user { id name email role isMaster }';

export type UserRole = 'admin' | 'user';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  /** The master admin (created with the CLI); names the other admins. */
  isMaster: boolean;
  /** Preferred language ('es' | 'en'); null when unset or not supported by the API yet. */
  locale?: string | null;
  /** Profile photo (uploaded or Google's); null: initials. */
  avatar?: UserAvatar | null;
  /** The privacy PIN: set, and unlocked in this browser right now. */
  privacy?: { hasPin: boolean; unlocked: boolean };
}

export interface UserAvatar {
  source: 'uploaded' | 'google';
  /** Google only; an uploaded photo is GET /api/files/me/avatar. */
  url: string | null;
  version: string;
}

/** The API's answer when a client or account made too many attempts. */
export const TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS';

export function isRateLimited(errors: GraphqlError[] | undefined): boolean {
  return Boolean(errors?.some((e) => e.extensions?.code === TOO_MANY_REQUESTS));
}

/** null: wrong email or password. Throws ApiRequestError when rate-limited. */
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
  if (isRateLimited(result.errors)) {
    throw new ApiRequestError('Too many attempts', TOO_MANY_REQUESTS);
  }
  return result.data?.signIn ?? null;
}

/** The API rejected a request; `code` is its GraphQL error code. */
export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

/**
 * Exchanges a Google ID token for a Finnit session. Only people an admin
 * already added get in (FORBIDDEN otherwise); throws ApiRequestError.
 */
export async function apiSignInWithGoogle(
  idToken: string,
  nonce: string,
): Promise<SessionTokens & { user: AuthUser }> {
  const result = await apiGraphql<{
    signInWithGoogle: SessionTokens & { user: AuthUser };
  }>(
    `mutation SignInWithGoogle($input: SignInWithGoogleInput!) { signInWithGoogle(input: $input) { ${AUTH_FIELDS} } }`,
    { input: { idToken, nonce } },
  );
  if (result.data?.signInWithGoogle) return result.data.signInWithGoogle;
  const error = result.errors?.[0];
  throw new ApiRequestError(
    error?.message ?? 'Google sign-in failed',
    error?.extensions?.code,
  );
}

/** `clientIp`: the visitor's, since the proxy runs outside next/headers. */
export async function apiRefresh(
  refreshToken: string,
  clientIp?: string,
): Promise<SessionTokens | null> {
  const result = await apiGraphql<{ refreshToken: SessionTokens }>(
    `mutation Refresh($input: RefreshTokenInput!) { refreshToken(input: $input) { accessToken refreshToken } }`,
    { input: { refreshToken } },
    undefined,
    {},
    clientIp,
  );
  return result.data?.refreshToken ?? null;
}
