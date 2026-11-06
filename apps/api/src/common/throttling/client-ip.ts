import { timingSafeEqual } from 'crypto';

/** Header the web server (backend-for-frontend) uses to pass the visitor's IP. */
export const CLIENT_IP_HEADER = 'x-finnit-client-ip';
/** Shared secret that proves the header above comes from our web server. */
export const BFF_SECRET_HEADER = 'x-finnit-bff-secret';

interface RequestLike {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}

function header(req: RequestLike, name: string): string | undefined {
  const value = req.headers?.[name];
  return Array.isArray(value) ? value[0] : value;
}

function sameSecret(given: string | undefined, expected: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * The IP to rate-limit by. Every call from the web app comes from the Next
 * server, so it forwards the visitor's IP; that header is trusted only with
 * the shared FINNIT_BFF_SECRET, otherwise anyone could pick their own IP.
 * Without it, the request's own IP (behind the reverse proxy, see
 * `trust proxy` in main.ts).
 */
export function clientIp(
  req: RequestLike,
  secret: string | undefined = process.env.FINNIT_BFF_SECRET,
): string {
  const forwarded = header(req, CLIENT_IP_HEADER)?.trim();
  if (
    secret &&
    forwarded &&
    sameSecret(header(req, BFF_SECRET_HEADER), secret)
  ) {
    return forwarded.slice(0, 64);
  }
  return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
}
