/**
 * The privacy unlock: after the user enters their privacy PIN, the API's
 * short-lived unlock token is kept in this httpOnly cookie and sent to the
 * API in the `x-privacy-unlock` header by /api/graphql and serverGraphql.
 * Browser JavaScript never sees it.
 */
export const PRIVACY_COOKIE = 'finnit_privacy';
export const PRIVACY_UNLOCK_HEADER = 'x-privacy-unlock';

/** Headers for an API request: the unlock token, when there is one. */
export function privacyHeaders(
  token: string | undefined,
): Record<string, string> {
  return token ? { [PRIVACY_UNLOCK_HEADER]: token } : {};
}

/** Seconds the cookie lives: until the token expires (at most 10 minutes). */
export function unlockMaxAge(expiresAt: string, now = Date.now()): number {
  const seconds = Math.floor((Date.parse(expiresAt) - now) / 1000);
  return Number.isFinite(seconds) ? Math.min(600, Math.max(0, seconds)) : 0;
}
