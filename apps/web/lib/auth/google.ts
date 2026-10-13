import { safeNextPath } from './redirect';

/**
 * Pure helpers for "Continuar con Google" (OAuth 2.0 authorization code +
 * PKCE). The route handlers in app/api/auth/google/ do the I/O; the client
 * secret and Google's tokens stay on the Next server.
 */
export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

/** Holds state, nonce, PKCE verifier and `next` between the two routes. */
export const GOOGLE_STATE_COOKIE = 'finnit_google_oauth';
export const GOOGLE_STATE_COOKIE_PATH = '/api/auth/google';
export const GOOGLE_STATE_MAX_AGE_S = 10 * 60;

export const GOOGLE_CALLBACK_PATH = '/api/auth/google/callback';

export type GoogleLoginError =
  | 'google_no_access'
  | 'google_failed'
  | 'google_unavailable';

export const LOGIN_ERROR_MESSAGES: Record<GoogleLoginError, string> = {
  google_no_access:
    'Tu cuenta de Google no tiene acceso a Finnit. Pide acceso al administrador.',
  google_failed: 'No pudimos iniciar sesión con Google. Intenta de nuevo.',
  google_unavailable: 'El inicio de sesión con Google no está disponible.',
};

/** The Spanish message for a `/login?error=` code, or null for unknown codes. */
export function loginErrorMessage(code: unknown): string | null {
  return typeof code === 'string' && Object.hasOwn(LOGIN_ERROR_MESSAGES, code)
    ? LOGIN_ERROR_MESSAGES[code as GoogleLoginError]
    : null;
}

export interface GoogleOAuthState {
  state: string;
  nonce: string;
  verifier: string;
  next: string;
  remember: boolean;
}

function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url');
}

/** 32 random bytes, base64url (43 chars: also a valid PKCE verifier). */
export function randomToken(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

/** PKCE S256: base64url(sha256(verifier)). */
export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier),
  );
  return base64url(new Uint8Array(digest));
}

export function newGoogleState(
  next: unknown,
  remember: boolean,
): GoogleOAuthState {
  return {
    state: randomToken(),
    nonce: randomToken(),
    verifier: randomToken(),
    next: safeNextPath(next),
    remember,
  };
}

export function encodeGoogleState(value: GoogleOAuthState): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

/** Parses the cookie; null when missing or tampered with. */
export function decodeGoogleState(
  raw: string | undefined,
): GoogleOAuthState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(
      Buffer.from(raw, 'base64url').toString('utf8'),
    ) as Partial<GoogleOAuthState>;
    if (
      typeof value.state !== 'string' ||
      typeof value.nonce !== 'string' ||
      typeof value.verifier !== 'string' ||
      !value.state ||
      !value.nonce ||
      !value.verifier
    ) {
      return null;
    }
    return {
      state: value.state,
      nonce: value.nonce,
      verifier: value.verifier,
      next: safeNextPath(value.next),
      remember: value.remember === true,
    };
  } catch {
    return null;
  }
}

/** Compares secrets without leaking where they differ through timing. */
export function safeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  // The length of a random token isn't secret.
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i]! ^ right[i]!;
  return diff === 0;
}

export function googleAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  nonce: string;
  challenge: string;
}): string {
  const url = new URL(GOOGLE_AUTH_URL);
  url.search = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: params.state,
    nonce: params.nonce,
    code_challenge: params.challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString();
  return url.toString();
}

/**
 * Maps the API's answer to `signInWithGoogle` to a login error. FORBIDDEN
 * means the person isn't invited (or is disabled), except when the API has
 * no Google client configured.
 */
export function googleSignInError(
  error: { code?: string; message?: string } | undefined,
): GoogleLoginError {
  if (error?.code === 'FORBIDDEN') {
    return /not available/i.test(error.message ?? '')
      ? 'google_unavailable'
      : 'google_no_access';
  }
  return 'google_failed';
}
