const DEV_FALLBACK_SECRET = 'default-secret-key';

/**
 * JWT signing secret. In production a missing secret is a fatal
 * misconfiguration: falling back to a public default would let anyone
 * forge tokens.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }
  return DEV_FALLBACK_SECRET;
}
