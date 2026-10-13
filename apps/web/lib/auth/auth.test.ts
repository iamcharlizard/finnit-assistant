import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  REMEMBER_COOKIE,
  clearSession,
  writeSession,
  type CookieWriter,
} from './cookies';
import { isExpiring, tokenExpiry } from './jwt';
import { safeNextPath } from './redirect';

const jwt = (payload: object) =>
  `h.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.s`;

function recorder() {
  const set: Record<
    string,
    { value: string; options: Record<string, unknown> }
  > = {};
  const deleted: string[] = [];
  const cookies: CookieWriter = {
    set: (name, value, options) => (set[name] = { value, options }),
    delete: (name) => deleted.push(name),
  };
  return { cookies, set, deleted };
}

describe('jwt', () => {
  it('reads the expiry without verifying', () => {
    assert.equal(tokenExpiry(jwt({ exp: 1_800_000_000 })), 1_800_000_000_000);
    assert.equal(tokenExpiry('not-a-jwt'), null);
    assert.equal(tokenExpiry(undefined), null);
  });

  it('treats tokens about to expire as expiring', () => {
    const now = 1_000_000_000_000;
    const token = jwt({ exp: (now + 30_000) / 1000 });
    assert.equal(isExpiring(token, now), true); // within the 60 s skew
    assert.equal(isExpiring(token, now, 0), false);
    assert.equal(isExpiring('garbage', now), true);
  });
});

describe('session cookies', () => {
  const tokens = {
    accessToken: jwt({ exp: Date.now() / 1000 + 900 }),
    refreshToken: 'refresh',
  };

  it('stores both tokens httpOnly and SameSite=Lax', () => {
    const { cookies, set } = recorder();
    writeSession(cookies, tokens, false);
    for (const name of [ACCESS_COOKIE, REFRESH_COOKIE]) {
      assert.equal(set[name]!.options.httpOnly, true);
      assert.equal(set[name]!.options.sameSite, 'lax');
      assert.equal(set[name]!.options.path, '/');
    }
    const accessAge = set[ACCESS_COOKIE]!.options.maxAge as number;
    assert.ok(accessAge > 890 && accessAge <= 900);
  });

  it('keeps the refresh cookie for the browser session unless remembered', () => {
    const once = recorder();
    writeSession(once.cookies, tokens, false);
    assert.equal(once.set[REFRESH_COOKIE]!.options.maxAge, undefined);
    assert.ok(once.deleted.includes(REMEMBER_COOKIE));

    const kept = recorder();
    writeSession(kept.cookies, tokens, true);
    assert.equal(kept.set[REFRESH_COOKIE]!.options.maxAge, 7 * 24 * 60 * 60);
    assert.equal(kept.set[REMEMBER_COOKIE]!.value, '1');
  });

  it('clears everything on sign out', () => {
    const { cookies, deleted } = recorder();
    clearSession(cookies);
    assert.deepEqual(
      deleted.sort(),
      [ACCESS_COOKIE, REFRESH_COOKIE, REMEMBER_COOKIE].sort(),
    );
  });
});

describe('safeNextPath', () => {
  it('only allows relative paths of this site', () => {
    assert.equal(safeNextPath('/history?month=9'), '/history?month=9');
    for (const bad of [
      'https://evil.com',
      '//evil.com',
      '/\\evil.com',
      '/login',
      undefined,
      42,
    ]) {
      assert.equal(safeNextPath(bad), '/dashboard');
    }
  });
});
