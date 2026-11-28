import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  ADMIN_HOME,
  BOTTOM_NAV_KEYS,
  NAV_SECTIONS,
  adminCanVisit,
  activeGroupKey,
  activeNavHref,
  isNavGroup,
  visibleSections,
} from './sections';
import { matchRoute, pageTitleKey } from '@finnit/core/nav/titles';
import {
  openGroupsCookieValue,
  parseOpenGroups,
} from '@finnit/core/nav/sidebar';

describe('nav sections', () => {
  it('hides empty sections; admins see only the panel, others only their finances', () => {
    const keys = (admin: boolean) => visibleSections(admin).map((s) => s.key);
    assert.deepEqual(keys(false), [
      'home',
      'transactions',
      'accounts',
      'calendar',
      'planning',
      'analytics',
    ]);
    assert.deepEqual(keys(true), ['users', 'system']);
    const empty = { key: 'planning' as const, items: [] };
    assert.deepEqual(
      visibleSections(true, [...NAV_SECTIONS, empty]).filter(
        (s) => s.items.length === 0,
      ),
      [],
    );
  });

  it('groups movements, planning and the admin panel, each with its own icon', () => {
    const groups = NAV_SECTIONS.filter(isNavGroup);
    assert.deepEqual(
      groups.map((g) => [g.key, g.items.map((i) => i.key)]),
      [
        ['transactions', ['history', 'recurring', 'statements']],
        ['planning', ['budgets', 'debts', 'goals', 'simulator']],
        ['users', ['adminUsers', 'waitlist']],
        ['system', ['adminAi', 'adminBanks']],
      ],
    );
    for (const group of groups) assert.ok(group.icon, group.key);
    // Settings lives in the profile menu, loans inside Debts.
    const hrefs = NAV_SECTIONS.flatMap((s) => s.items.map((i) => i.href));
    assert.ok(!hrefs.includes('/settings'));
    assert.ok(!hrefs.includes('/planning/loans'));
  });

  it('knows the group of the current page', () => {
    assert.equal(activeGroupKey(NAV_SECTIONS, '/recurring'), 'transactions');
    assert.equal(activeGroupKey(NAV_SECTIONS, '/planning/debts'), 'planning');
    assert.equal(activeGroupKey(NAV_SECTIONS, '/admin/waitlist'), 'users');
    assert.equal(
      activeGroupKey(NAV_SECTIONS, '/admin/settings/banks'),
      'system',
    );
    assert.equal(activeGroupKey(NAV_SECTIONS, '/dashboard'), null);
    assert.equal(activeGroupKey(NAV_SECTIONS, null), null);
  });

  it('keeps the bottom bar to screens that exist', () => {
    const all = NAV_SECTIONS.flatMap((s) => s.items.map((i) => i.key));
    for (const key of BOTTOM_NAV_KEYS) assert.ok(all.includes(key), key);
  });

  it('marks the entry of a page and of its sub-pages', () => {
    const hrefs = ['/dashboard', '/settings', '/admin'];
    assert.equal(activeNavHref(hrefs, '/settings/banks'), '/settings');
    assert.equal(activeNavHref(hrefs, '/admin/ai'), '/admin');
    assert.equal(activeNavHref(hrefs, '/settingsx'), null);
    // History and recurring live side by side in "Movimientos".
    const tx = ['/history', '/recurring'];
    assert.equal(activeNavHref(tx, '/recurring'), '/recurring');
  });
});

describe('admin accounts', () => {
  it('stay in the panel, their settings and notifications', () => {
    for (const path of [
      ADMIN_HOME,
      '/admin',
      '/admin/settings/banks',
      '/settings',
      '/settings/',
      '/notifications',
    ]) {
      assert.ok(adminCanVisit(path), path);
    }
    for (const path of [
      '/dashboard',
      '/history',
      '/accounts',
      '/settings/banks',
      '/settings/categories',
      '/administrator',
    ]) {
      assert.ok(!adminCanVisit(path), path);
    }
  });
});

describe('open sidebar groups (cookie)', () => {
  it('reads only plain keys and writes them back once each', () => {
    assert.deepEqual(parseOpenGroups('transactions. planning.<x>.'), [
      'transactions',
      'planning',
    ]);
    assert.deepEqual(parseOpenGroups(undefined), []);
    assert.equal(
      openGroupsCookieValue(['planning', 'planning', 'transactions']),
      'planning.transactions',
    );
  });
});

describe('page titles', () => {
  it('matches static and dynamic segments', () => {
    assert.ok(matchRoute('/transactions/[id]', '/transactions/abc'));
    assert.ok(!matchRoute('/transactions/[id]', '/transactions'));
    assert.ok(!matchRoute('/transactions/[id]', '/transactions/a/b'));
    assert.ok(matchRoute('/admin/[...rest]', '/admin/ai/x'));
    assert.ok(!matchRoute('/admin/[...rest]', '/admin'));
    assert.ok(matchRoute('/history', '/history/'));
  });

  it('picks the specific route before the dynamic one', () => {
    assert.equal(pageTitleKey('/settings/banks/connect'), 'connectBank');
    assert.equal(pageTitleKey('/settings/aliases'), 'aliases');
    assert.equal(pageTitleKey('/admin/users'), 'adminUsers');
    assert.equal(pageTitleKey('/admin/settings/banks'), 'adminBanks');
    assert.equal(pageTitleKey('/admin/other'), 'admin');
    assert.equal(pageTitleKey('/calendar'), 'calendar');
    assert.equal(pageTitleKey('/accounts'), 'cards');
    assert.equal(pageTitleKey('/nowhere'), 'app');
  });
});
