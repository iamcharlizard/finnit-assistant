import { NextResponse, type NextRequest } from 'next/server';

import {
  GOOGLE_CALLBACK_PATH,
  GOOGLE_STATE_COOKIE,
  GOOGLE_STATE_COOKIE_PATH,
  GOOGLE_STATE_MAX_AGE_S,
  encodeGoogleState,
  googleAuthUrl,
  newGoogleState,
  pkceChallenge,
} from '@/lib/auth/google';

/**
 * "Continuar con Google": sends the browser to Google's consent screen.
 * state (CSRF), nonce (ID token replay) and the PKCE verifier wait in a
 * short-lived httpOnly cookie that only the callback receives.
 */
export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(
      new URL('/login?error=google_unavailable', request.url),
    );
  }

  const { origin, searchParams } = request.nextUrl;
  const oauth = newGoogleState(
    searchParams.get('next'),
    searchParams.get('remember') === '1',
  );
  const response = NextResponse.redirect(
    googleAuthUrl({
      clientId,
      redirectUri: `${origin}${GOOGLE_CALLBACK_PATH}`,
      state: oauth.state,
      nonce: oauth.nonce,
      challenge: await pkceChallenge(oauth.verifier),
    }),
  );
  response.cookies.set(GOOGLE_STATE_COOKIE, encodeGoogleState(oauth), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    // Lax: the cookie must come back on Google's top-level redirect.
    sameSite: 'lax',
    path: GOOGLE_STATE_COOKIE_PATH,
    maxAge: GOOGLE_STATE_MAX_AGE_S,
  });
  return response;
}
