import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  APP_THEMES,
  DEFAULT_APP_THEME,
  PREVIEW_THEME_COOKIE,
  expiredPreferenceCookie,
  resolveAppTheme,
  siteTheme,
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
      preferenceCookie(PREVIEW_THEME_COOKIE, 'glass'),
      'finnit-theme-preview=glass; path=/; max-age=31536000; samesite=lax',
    );
    assert.equal(
      expiredPreferenceCookie(PREVIEW_THEME_COOKIE),
      'finnit-theme-preview=; path=/; max-age=0; samesite=lax',
    );
  });

  it('uses the site palette from FINNIT_THEME', () => {
    assert.equal(siteTheme('suave'), 'suave');
    assert.equal(siteTheme(undefined), 'finnit');
    assert.equal(siteTheme('nope'), 'finnit');
  });

  it('lets a valid preview win over the site palette', () => {
    assert.equal(resolveAppTheme('glass', 'mono'), 'glass');
    assert.equal(resolveAppTheme(undefined, 'mono'), 'mono');
    assert.equal(resolveAppTheme('ember', 'mono'), 'mono');
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
