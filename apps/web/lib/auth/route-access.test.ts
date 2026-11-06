import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { routeDecision } from './route-access';

const anonymous = (pathname: string, search = '') =>
  routeDecision({ pathname, search, signedIn: false });
const signedIn = (pathname: string) =>
  routeDecision({ pathname, search: '', signedIn: true });

describe('routeDecision', () => {
  it('sends visitors without a session from every app page to /login', () => {
    for (const path of [
      '/dashboard',
      '/history',
      '/accounts',
      '/accounts/acc-1',
      '/analytics',
      '/budgets',
      '/debts',
      '/recurring',
      '/settings',
      '/settings/banks',
      '/admin',
      '/admin/users',
      '/admin/waitlist',
      '/something-new',
    ]) {
      assert.equal(anonymous(path).kind, 'login', path);
    }
  });

  it('keeps where they were going', () => {
    assert.deepEqual(anonymous('/history', '?month=2026-11'), {
      kind: 'login',
      next: '/history?month=2026-11',
    });
  });

  it('answers 401 on the API routes without a session', () => {
    for (const path of [
      '/api/graphql',
      '/api/files/me/avatar',
      '/api/files/statements/s-1/file',
      '/api',
    ]) {
      assert.equal(anonymous(path).kind, 'unauthorized', path);
    }
  });

  it('lets anyone see the landing, sign-in and what crawlers read', () => {
    for (const path of [
      '/',
      '/login',
      '/robots.txt',
      '/sitemap.xml',
      '/opengraph-image',
      '/api/auth/google',
      '/api/auth/google/callback',
    ]) {
      assert.equal(anonymous(path).kind, 'next', path);
    }
  });

  it('does not treat look-alike paths as public', () => {
    for (const path of ['/login/x', '/robots.txt/x', '/api/auth/google/x']) {
      assert.notEqual(anonymous(path).kind, 'next', path);
    }
  });

  it('shows the landing to signed-in users too, but skips /login', () => {
    assert.equal(signedIn('/').kind, 'next');
    assert.equal(signedIn('/login').kind, 'dashboard');
    assert.equal(signedIn('/dashboard').kind, 'next');
  });
});
