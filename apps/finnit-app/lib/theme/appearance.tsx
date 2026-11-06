import * as React from 'react';
import { Appearance } from 'react-native';

import { isAppTheme, type AppTheme } from '@finnit/core/theme/app-theme';

import { readItem, writeItem } from '@/lib/session/storage';
import { APP_THEME } from './app-theme';

/** Light, dark or the system's: the only appearance choice users have (like the web). */
export type AppearancePreference = 'system' | 'light' | 'dark';

function isAppearance(value: unknown): value is AppearancePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

function applyAppearance(preference: AppearancePreference) {
  // 'unspecified' gives control back to the system setting.
  Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
}

interface AppearanceContextValue {
  appearance: AppearancePreference;
  setAppearance: (preference: AppearancePreference) => void;
  /** The palette in use: the app's (EXPO_PUBLIC_FINNIT_THEME) or an admin's preview. */
  theme: AppTheme;
  /** An admin's preview of another palette, on this device only; null = the app's. */
  previewTheme: AppTheme | null;
  setPreviewTheme: (theme: AppTheme | null) => void;
}

const AppearanceContext = React.createContext<AppearanceContextValue | null>(null);

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [appearance, setAppearanceState] = React.useState<AppearancePreference>(() => {
    const saved = readItem('appearance');
    const preference = isAppearance(saved) ? saved : 'system';
    applyAppearance(preference);
    return preference;
  });
  const [previewTheme, setPreviewState] = React.useState<AppTheme | null>(() => {
    const saved = readItem('themePreview');
    return isAppTheme(saved) ? saved : null;
  });

  const value = React.useMemo<AppearanceContextValue>(
    () => ({
      appearance,
      setAppearance: (preference) => {
        applyAppearance(preference);
        setAppearanceState(preference);
        void writeItem('appearance', preference);
      },
      theme: previewTheme ?? APP_THEME,
      previewTheme,
      setPreviewTheme: (theme) => {
        const next = theme === APP_THEME ? null : theme;
        setPreviewState(next);
        void writeItem('themePreview', next);
      },
    }),
    [appearance, previewTheme],
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance(): AppearanceContextValue {
  const context = React.useContext(AppearanceContext);
  if (!context) throw new Error('useAppearance must be used within <AppearanceProvider>');
  return context;
}
