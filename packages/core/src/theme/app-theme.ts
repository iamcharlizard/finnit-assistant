/**
 * App themes (the palette), each with light and dark. FINNIT_THEME sets the
 * default; every user can pick another one for their own browser (a
 * cookie; on the app, the device's storage). The server renders `<html data-theme>`, so
 * the first paint already has the right colors; the tokens live in
 * @finnit/ui's globals.css.
 */
export const APP_THEMES = ['finnit', 'glass', 'suave', 'mono'] as const;

export type AppTheme = (typeof APP_THEMES)[number];

export const DEFAULT_APP_THEME: AppTheme = 'finnit';

/** The palette a user picked in this browser (overrides the default). */
export const PREVIEW_THEME_COOKIE = 'finnit-theme-preview';

/** One year, in seconds. */
export const PREFERENCE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isAppTheme(value: unknown): value is AppTheme {
  return (
    typeof value === 'string' &&
    (APP_THEMES as readonly string[]).includes(value)
  );
}

/** The saved theme, or the default for a missing or unknown value. */
export function parseAppTheme(value: string | null | undefined): AppTheme {
  return isAppTheme(value) ? value : DEFAULT_APP_THEME;
}

/** The site's palette: FINNIT_THEME, or the default when unset or unknown. */
export function siteTheme(
  value: string | undefined = process.env.FINNIT_THEME,
): AppTheme {
  return parseAppTheme(value);
}

/** What to render: a valid preview, otherwise the site's palette. */
export function resolveAppTheme(
  preview: string | null | undefined,
  site: AppTheme,
): AppTheme {
  return isAppTheme(preview) ? preview : site;
}

/** A browser cookie string for a UI preference (not sensitive, readable by JS). */
export function preferenceCookie(name: string, value: string): string {
  return `${name}=${value}; path=/; max-age=${PREFERENCE_COOKIE_MAX_AGE}; samesite=lax`;
}

/** Deletes a preference cookie written with preferenceCookie. */
export function expiredPreferenceCookie(name: string): string {
  return `${name}=; path=/; max-age=0; samesite=lax`;
}
