import { NextResponse, type NextRequest } from 'next/server';

import { ApiRequestError, apiSignInWithGoogle } from '@/lib/api/finnit-api';
import { writeSession } from '@/lib/auth/cookies';
import {
  GOOGLE_CALLBACK_PATH,
  GOOGLE_STATE_COOKIE,
  GOOGLE_STATE_COOKIE_PATH,
  GOOGLE_TOKEN_URL,
  decodeGoogleState,
  googleSignInError,
  safeEqual,
  type GoogleLoginError,
} from '@/lib/auth/google';

/**
 * Google sends the browser back here with a one-time code. This server
 * swaps it for an ID token (with the client secret and PKCE verifier) and
 * hands the token to the Finnit API, which decides whether the person has
 * access. Tokens are never logged nor sent to the browser.
 */
export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  const oauth = decodeGoogleState(
    request.cookies.get(GOOGLE_STATE_COOKIE)?.value,
  );

  const finish = (target: string) => {
    const response = NextResponse.redirect(new URL(target, request.url));
    response.cookies.delete({
      name: GOOGLE_STATE_COOKIE,
      path: GOOGLE_STATE_COOKIE_PATH,
    });
    return response;
  };
  const fail = (error: GoogleLoginError) => finish(`/login?error=${error}`);

  // The person closed or denied Google's screen: back to login, no error.
  if (searchParams.get('error')) return finish('/login');

  const state = searchParams.get('state');
  const code = searchParams.get('code');
  if (!oauth || !state || !code || !safeEqual(state, oauth.state)) {
    return fail('google_failed');
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return fail('google_unavailable');

  let idToken: string | undefined;
  try {
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        code_verifier: oauth.verifier,
        grant_type: 'authorization_code',
        redirect_uri: `${origin}${GOOGLE_CALLBACK_PATH}`,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    if (tokenResponse.ok) {
      const json = (await tokenResponse.json()) as { id_token?: unknown };
      if (typeof json.id_token === 'string') idToken = json.id_token;
    } else {
      console.warn(
        `Google token exchange failed: HTTP ${tokenResponse.status}`,
      );
    }
  } catch {
    console.warn('Google token endpoint unreachable');
  }
  if (!idToken) return fail('google_failed');

  let session: Awaited<ReturnType<typeof apiSignInWithGoogle>>;
  try {
    session = await apiSignInWithGoogle(idToken, oauth.nonce);
  } catch (error) {
    return fail(
      googleSignInError(error instanceof ApiRequestError ? error : undefined),
    );
  }

  const response = finish(oauth.next);
  // "Mantener sesión iniciada" works as with the password: the login form
  // forwards the checkbox (remember=1), so an unchecked box keeps the
  // session only until the browser closes, like a password sign-in.
  writeSession(response.cookies, session, oauth.remember);
  return response;
}
