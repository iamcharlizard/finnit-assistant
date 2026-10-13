/**
 * Reads the expiry of a JWT without verifying it. Only used to decide when
 * to refresh the session; the API verifies every token it receives.
 */
export function tokenExpiry(token: string | undefined): number | null {
  const payload = token?.split('.')[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(
      Buffer.from(
        payload.replace(/-/g, '+').replace(/_/g, '/'),
        'base64',
      ).toString('utf8'),
    ) as { exp?: unknown };
    return typeof json.exp === 'number' ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** True when the token is missing, malformed or expires within `skewMs`. */
export function isExpiring(
  token: string | undefined,
  now = Date.now(),
  skewMs = 60_000,
): boolean {
  const expiry = tokenExpiry(token);
  return expiry === null || expiry - skewMs <= now;
}
