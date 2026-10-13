import { tokenExpiry } from './jwt';

/**
 * Session cookies. Both tokens are httpOnly: browser JavaScript never sees
 * them, so an XSS bug can't steal the session. SameSite=Lax keeps them off
 * cross-site POSTs (CSRF).
 */
export const ACCESS_COOKIE = 'finnit_at';
export const REFRESH_COOKIE = 'finnit_rt';
/** Marks a session the user asked to keep ("Mantener sesión iniciada"). */
export const REMEMBER_COOKIE = 'finnit_remember';

const REFRESH_MAX_AGE_S = 7 * 24 * 60 * 60;

export interface CookieWriter {
  set(
    name: string,
    value: string,
    options: {
      httpOnly: boolean;
      secure: boolean;
      sameSite: 'lax';
      path: string;
      maxAge?: number;
    },
  ): unknown;
  delete(name: string): unknown;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

function base() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  };
}

/**
 * Stores the tokens. Without `remember`, the refresh cookie lasts until the
 * browser closes; with it, as long as the refresh token (7 days).
 */
export function writeSession(
  cookies: CookieWriter,
  tokens: SessionTokens,
  remember: boolean,
): void {
  const accessExpiry = tokenExpiry(tokens.accessToken);
  cookies.set(ACCESS_COOKIE, tokens.accessToken, {
    ...base(),
    maxAge: accessExpiry
      ? Math.max(0, Math.floor((accessExpiry - Date.now()) / 1000))
      : 15 * 60,
  });
  cookies.set(REFRESH_COOKIE, tokens.refreshToken, {
    ...base(),
    ...(remember && { maxAge: REFRESH_MAX_AGE_S }),
  });
  if (remember) {
    cookies.set(REMEMBER_COOKIE, '1', { ...base(), maxAge: REFRESH_MAX_AGE_S });
  } else {
    cookies.delete(REMEMBER_COOKIE);
  }
}

export function clearSession(cookies: CookieWriter): void {
  cookies.delete(ACCESS_COOKIE);
  cookies.delete(REFRESH_COOKIE);
  cookies.delete(REMEMBER_COOKIE);
}
