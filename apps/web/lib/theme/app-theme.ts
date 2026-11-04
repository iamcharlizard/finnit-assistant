/**
 * App themes (the palette), independent from light/dark. The server reads
 * the cookie and renders `<html data-theme>`, so the first paint already has
 * the right colors; the tokens live in @finnit/ui's globals.css.
 */
export const APP_THEMES = ['finnit', 'glass', 'suave', 'mono'] as const;

export type AppTheme = (typeof APP_THEMES)[number];

export const DEFAULT_APP_THEME: AppTheme = 'finnit';

export const THEME_COOKIE = 'finnit-theme';

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

/** A browser cookie string for a UI preference (not sensitive, readable by JS). */
export function preferenceCookie(name: string, value: string): string {
  return `${name}=${value}; path=/; max-age=${PREFERENCE_COOKIE_MAX_AGE}; samesite=lax`;
}
