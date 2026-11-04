'use client';

import * as React from 'react';

import {
  THEME_COOKIE,
  preferenceCookie,
  type AppTheme,
} from '@/lib/theme/app-theme';

interface AppThemeContextValue {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
}

const AppThemeContext = React.createContext<AppThemeContextValue | null>(null);

/**
 * The app theme (palette). The server already rendered `<html data-theme>`
 * from the cookie; changing it updates the attribute and the cookie, so the
 * next request renders the same theme. Light/dark stays with next-themes.
 */
export function AppThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme: AppTheme;
  children: React.ReactNode;
}) {
  const [theme, setThemeState] = React.useState(initialTheme);

  const setTheme = React.useCallback((next: AppTheme) => {
    setThemeState(next);
    document.documentElement.dataset.theme = next;
    document.cookie = preferenceCookie(THEME_COOKIE, next);
  }, []);

  const value = React.useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
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
