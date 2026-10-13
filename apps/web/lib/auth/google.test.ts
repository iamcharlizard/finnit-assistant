import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';

import {
  decodeGoogleState,
  encodeGoogleState,
  googleAuthUrl,
  googleSignInError,
  loginErrorMessage,
  newGoogleState,
  pkceChallenge,
  randomToken,
  safeEqual,
} from './google';

describe('PKCE', () => {
  it('makes random verifiers within the RFC 7636 alphabet and length', () => {
    const a = randomToken();
    assert.match(a, /^[A-Za-z0-9_-]{43}$/);
    assert.notEqual(a, randomToken());
  });

  it('derives the S256 challenge', async () => {
    // Example from RFC 7636, appendix B.
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    assert.equal(
      await pkceChallenge(verifier),
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
    const other = randomToken();
    assert.equal(
      await pkceChallenge(other),
      createHash('sha256').update(other).digest('base64url'),
    );
  });
});

describe('state cookie', () => {
  it('round-trips and keeps only safe `next` paths', () => {
    const state = newGoogleState('/history?month=9', true);
    assert.deepEqual(decodeGoogleState(encodeGoogleState(state)), state);
    assert.equal(newGoogleState('https://evil.com', false).next, '/dashboard');
    assert.equal(
      decodeGoogleState(encodeGoogleState({ ...state, next: '//evil.com' }))
        ?.next,
      '/dashboard',
    );
  });

  it('rejects missing or tampered cookies', () => {
    assert.equal(decodeGoogleState(undefined), null);
    assert.equal(decodeGoogleState('not-json'), null);
    assert.equal(
      decodeGoogleState(
        Buffer.from(JSON.stringify({ state: 'x' })).toString('base64url'),
      ),
      null,
    );
  });

  it('compares states exactly', () => {
    assert.equal(safeEqual('abc', 'abc'), true);
    assert.equal(safeEqual('abc', 'abd'), false);
    assert.equal(safeEqual('abc', 'abcd'), false);
    assert.equal(safeEqual('', 'a'), false);
  });
});

describe('googleAuthUrl', () => {
  it('asks for an OpenID code with PKCE', () => {
    const url = new URL(
      googleAuthUrl({
        clientId: 'client.apps.googleusercontent.com',
        redirectUri: 'http://localhost:3001/api/auth/google/callback',
        state: 's',
        nonce: 'n',
        challenge: 'c',
      }),
    );
    assert.equal(
      url.origin + url.pathname,
      'https://accounts.google.com/o/oauth2/v2/auth',
    );
    assert.deepEqual(Object.fromEntries(url.searchParams), {
      client_id: 'client.apps.googleusercontent.com',
      redirect_uri: 'http://localhost:3001/api/auth/google/callback',
      response_type: 'code',
      scope: 'openid email profile',
      state: 's',
      nonce: 'n',
      code_challenge: 'c',
      code_challenge_method: 'S256',
      prompt: 'select_account',
    });
  });
});

describe('login errors', () => {
  it('maps the API answer to a login error', () => {
    assert.equal(
      googleSignInError({
        code: 'FORBIDDEN',
        message: 'Tu cuenta no tiene acceso',
      }),
      'google_no_access',
    );
    assert.equal(
      googleSignInError({
        code: 'FORBIDDEN',
        message: 'Google sign-in is not available',
      }),
      'google_unavailable',
    );
    assert.equal(
      googleSignInError({ code: 'UNAUTHORIZED', message: 'Invalid' }),
      'google_failed',
    );
    assert.equal(googleSignInError(undefined), 'google_failed');
  });

  it('only shows messages for known codes', () => {
    assert.match(
      loginErrorMessage('google_no_access') ?? '',
      /no tiene acceso/,
    );
    assert.equal(loginErrorMessage('<script>'), null);
    assert.equal(loginErrorMessage('toString'), null);
    assert.equal(loginErrorMessage(['google_failed']), null);
  });
});
