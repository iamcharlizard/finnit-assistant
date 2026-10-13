import { NextResponse, type NextRequest } from 'next/server';

import { apiRefresh } from '@/lib/api/finnit-api';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  REMEMBER_COOKIE,
  clearSession,
  writeSession,
  type SessionTokens,
} from '@/lib/auth/cookies';
import { isExpiring } from '@/lib/auth/jwt';

const PUBLIC_PATHS = ['/login'];

/**
 * Runs before every page and /api route:
 * - renews the access token with the refresh token when it is about to
 *   expire (15 min tokens), so pages and /api/graphql always get a fresh one;
 * - sends visitors without a session to /login, and signed-in users away
 *   from /login.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.includes(pathname);
  const isApi = pathname.startsWith('/api/');

  let access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  let renewed: SessionTokens | null = null;
  let refreshFailed = false;

  if (refresh && isExpiring(access)) {
    renewed = await apiRefresh(refresh).catch(() => null);
    if (renewed) access = renewed.accessToken;
    else refreshFailed = true;
  }
  const signedIn = Boolean(access) && !isExpiring(access, Date.now(), 0);

  let response: NextResponse;
  if (!signedIn && !isPublic) {
    if (isApi) {
      response = NextResponse.json(
        {
          errors: [
            {
              message: 'Unauthorized',
              extensions: { code: 'UNAUTHENTICATED' },
            },
          ],
        },
        { status: 401 },
      );
    } else {
      const login = new URL('/login', request.url);
      if (pathname !== '/')
        login.searchParams.set('next', `${pathname}${search}`);
      response = NextResponse.redirect(login);
    }
  } else if (signedIn && (isPublic || pathname === '/')) {
    response = NextResponse.redirect(new URL('/dashboard', request.url));
  } else if (renewed) {
    // Hand the fresh token to this same request, not only to the browser.
    request.cookies.set(ACCESS_COOKIE, renewed.accessToken);
    request.cookies.set(REFRESH_COOKIE, renewed.refreshToken);
    response = NextResponse.next({ request: { headers: request.headers } });
  } else {
    response = NextResponse.next();
  }

  if (renewed) {
    writeSession(
      response.cookies,
      renewed,
      request.cookies.get(REMEMBER_COOKIE)?.value === '1',
    );
  } else if (refreshFailed) {
    clearSession(response.cookies);
  }
  return response;
}

export const config = {
  // Everything except Next internals and static files.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|woff2?)$).*)',
  ],
};
