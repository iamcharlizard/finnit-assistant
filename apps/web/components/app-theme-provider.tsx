'use client';

import * as React from 'react';

import {
  PREVIEW_THEME_COOKIE,
  expiredPreferenceCookie,
  preferenceCookie,
  type AppTheme,
} from '@/lib/theme/app-theme';

interface AppThemeContextValue {
  /** The palette on screen. */
  theme: AppTheme;
  /** The site's palette (FINNIT_THEME). */
  siteTheme: AppTheme;
  /** Previews a palette in this browser only (admins). */
  previewTheme: (theme: AppTheme) => void;
  /** Back to the site's palette. */
  resetTheme: () => void;
}

const AppThemeContext = React.createContext<AppThemeContextValue | null>(null);

/**
 * The palette. The server already rendered `<html data-theme>`; a preview
 * updates the attribute and a cookie, so the next request renders the same
 * one. Light/dark stays with next-themes.
 */
export function AppThemeProvider({
  initialTheme,
  siteTheme,
  children,
}: {
  initialTheme: AppTheme;
  siteTheme: AppTheme;
  children: React.ReactNode;
}) {
  const [theme, setThemeState] = React.useState(initialTheme);

  const apply = React.useCallback((next: AppTheme, cookie: string) => {
    setThemeState(next);
    document.documentElement.dataset.theme = next;
    document.cookie = cookie;
  }, []);

  const previewTheme = React.useCallback(
    (next: AppTheme) =>
      apply(
        next,
        next === siteTheme
          ? expiredPreferenceCookie(PREVIEW_THEME_COOKIE)
          : preferenceCookie(PREVIEW_THEME_COOKIE, next),
      ),
    [apply, siteTheme],
  );

  const resetTheme = React.useCallback(
    () => apply(siteTheme, expiredPreferenceCookie(PREVIEW_THEME_COOKIE)),
    [apply, siteTheme],
  );

  const value = React.useMemo(
    () => ({ theme, siteTheme, previewTheme, resetTheme }),
    [theme, siteTheme, previewTheme, resetTheme],
  );
  return (
    <AppThemeContext.Provider value={value}>
      {children}
    </AppThemeContext.Provider>
  );
}

export function useAppTheme(): AppThemeContextValue {
  const value = React.useContext(AppThemeContext);
  if (!value) throw new Error('useAppTheme needs an <AppThemeProvider>');
  return value;
}
