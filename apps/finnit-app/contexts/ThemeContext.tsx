import React, { createContext, useContext, useState } from 'react';
import { useColorScheme } from 'nativewind';

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

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { colorScheme: systemColorScheme } = useColorScheme();
  const [override, setOverride] = useState<ColorScheme | null>(null);

  const colorScheme: ColorScheme = override ?? (systemColorScheme === 'dark' ? 'dark' : 'light');
  const isDark = colorScheme === 'dark';

  function toggleTheme() {
    setOverride(isDark ? 'light' : 'dark');
  }

  function setTheme(scheme: ColorScheme) {
    setOverride(scheme);
  }

  return (
    <ThemeContext.Provider value={{ colorScheme, isDark, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
