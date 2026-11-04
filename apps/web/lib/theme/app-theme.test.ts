import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  APP_THEMES,
  DEFAULT_APP_THEME,
  THEME_COOKIE,
  isAppTheme,
  parseAppTheme,
  preferenceCookie,
} from './app-theme';
import { parseSidebarCollapsed, sidebarCookieValue } from '../nav/sidebar';

describe('app theme', () => {
  it('keeps a known theme and falls back to finnit otherwise', () => {
    for (const theme of APP_THEMES) assert.equal(parseAppTheme(theme), theme);
    assert.equal(parseAppTheme(undefined), DEFAULT_APP_THEME);
    assert.equal(parseAppTheme(''), 'finnit');
    assert.equal(parseAppTheme('ember'), 'finnit');
    assert.equal(parseAppTheme('GLASS'), 'finnit');
  });

  it('recognizes only the listed themes', () => {
    assert.equal(isAppTheme('mono'), true);
    assert.equal(isAppTheme(1), false);
    assert.equal(isAppTheme(null), false);
  });

  it('writes a lax, site-wide cookie that lasts a year', () => {
    assert.equal(
      preferenceCookie(THEME_COOKIE, 'glass'),
      'finnit-theme=glass; path=/; max-age=31536000; samesite=lax',
    );
  });
});

describe('sidebar state', () => {
  it('is expanded unless the cookie says collapsed', () => {
    assert.equal(parseSidebarCollapsed('collapsed'), true);
    assert.equal(parseSidebarCollapsed('expanded'), false);
    assert.equal(parseSidebarCollapsed(undefined), false);
    assert.equal(parseSidebarCollapsed('yes'), false);
  });

  it('round-trips through the cookie value', () => {
    assert.equal(parseSidebarCollapsed(sidebarCookieValue(true)), true);
    assert.equal(parseSidebarCollapsed(sidebarCookieValue(false)), false);
  });
});
