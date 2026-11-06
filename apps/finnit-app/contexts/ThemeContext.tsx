import { createContext, useContext, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { useAppearance } from '@/lib/theme/appearance';

/**
 * LEGACY: light/dark for the screens not migrated to @finnit/ui-native yet
 * (they pick colors with `isDark`). New code uses `dark:` classes and
 * useAppearance() to change the preference.
 */
type ColorScheme = 'light' | 'dark';

interface ThemeContextValue {
  colorScheme: ColorScheme;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (scheme: ColorScheme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  colorScheme: 'light',
  isDark: false,
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const colorScheme: ColorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const { setAppearance } = useAppearance();
  const isDark = colorScheme === 'dark';
  return (
    <ThemeContext.Provider
      value={{
        colorScheme,
        isDark,
        toggleTheme: () => setAppearance(isDark ? 'light' : 'dark'),
        setTheme: setAppearance,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
