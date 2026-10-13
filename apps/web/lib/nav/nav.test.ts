import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  BOTTOM_NAV_KEYS,
  NAV_SECTIONS,
  activeNavHref,
  visibleSections,
} from './sections';
import { matchRoute, pageTitleKey } from './titles';

describe('nav sections', () => {
  it('hides empty sections and, for non-admins, Administración', () => {
    const keys = (admin: boolean) => visibleSections(admin).map((s) => s.key);
    assert.deepEqual(keys(false), [
      'home',
      'transactions',
      'recurring',
      'accounts',
      'analytics',
      'settings',
    ]);
    assert.equal(keys(true).at(-1), 'admin');
    assert.ok(!keys(true).includes('planning'));
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
    assert.equal(pageTitleKey('/transactions/categorize'), 'categorize');
    assert.equal(pageTitleKey('/transactions/123'), 'transaction');
    assert.equal(pageTitleKey('/settings/banks/connect'), 'connectBank');
    assert.equal(pageTitleKey('/admin/users'), 'admin');
    assert.equal(pageTitleKey('/calendar'), 'recurring');
    assert.equal(pageTitleKey('/nowhere'), 'app');
  });
});
