/**
 * Who may open what. The proxy asks this for every page and /api route;
 * everything not listed here as public needs a session.
 */

/** Reachable without a session (exact paths). */
export const PUBLIC_PATHS: ReadonlySet<string> = new Set([
  // Marketing landing and what search engines / link previews read.
  '/',
  '/robots.txt',
  '/sitemap.xml',
  '/opengraph-image',
  '/twitter-image',
  // Signing in.
  '/login',
  '/api/auth/google',
  '/api/auth/google/callback',
]);

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname);
}

export type RouteDecision =
  /** Let it through. */
  | { kind: 'next' }
  /** /api/* without a session: 401 JSON. */
  | { kind: 'unauthorized' }
  /** A page without a session: to /login, back here afterwards. */
  | { kind: 'login'; next?: string }
  /** Signed in on /login: straight to the app. */
  | { kind: 'dashboard' };

export function routeDecision(input: {
  pathname: string;
  search: string;
  signedIn: boolean;
}): RouteDecision {
  const { pathname, search, signedIn } = input;
  if (signedIn) {
    return pathname === '/login' ? { kind: 'dashboard' } : { kind: 'next' };
  }
  if (isPublicPath(pathname)) return { kind: 'next' };
  if (pathname === '/api' || pathname.startsWith('/api/')) {
    return { kind: 'unauthorized' };
  }
  return { kind: 'login', next: `${pathname}${search}` };
}
