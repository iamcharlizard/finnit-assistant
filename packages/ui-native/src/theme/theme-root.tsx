import * as React from 'react';
import { StyleSheet, useColorScheme, useWindowDimensions, View } from 'react-native';
import { VariableContextProvider } from 'react-native-css';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { DEFAULT_APP_THEME, type AppTheme } from '@finnit/core/theme/app-theme';

import { THEMES } from './tokens.generated';
import { withTints, type BackgroundBlob, type ColorScheme, type TokenMap } from './tokens-source';

interface AppThemeValue {
  /** The palette (finnit, glass, suave, mono). */
  theme: AppTheme;
  /** Light or dark, from the system or the user's choice (Appearance). */
  scheme: ColorScheme;
  /** Every token resolved for this palette and scheme ('--card' → '#ffffff'), with tints. */
  tokens: TokenMap;
}

const AppThemeContext = React.createContext<AppThemeValue>({
  theme: DEFAULT_APP_THEME,
  scheme: 'light',
  tokens: withTints(THEMES[DEFAULT_APP_THEME].light.tokens),
});

/** The current palette, scheme and resolved tokens. */
export function useAppTheme(): AppThemeValue {
  return React.useContext(AppThemeContext);
}

/**
 * A token's value for props that don't take classes (icon colors, SVG
 * fills, native blur tints): `useToken('--on-surface-variant')`.
 */
export function useToken(name: `--${string}`): string {
  const { tokens } = useAppTheme();
  const value = tokens[name];
  if (value === undefined) throw new Error(`Unknown token ${name}`);
  return value;
}

/**
 * The web's `shadow-elevation` (and `shadow-well` with `inset`): the
 * theme's box-shadow as a style. Shadows read through a CSS variable don't
 * reach React Native, so components put this in `style`.
 */
export function useElevation(kind: 'raised' | 'inset' = 'raised'): { boxShadow: string } {
  const { tokens } = useAppTheme();
  return { boxShadow: tokens[kind === 'inset' ? '--elevation-inset' : '--elevation'] ?? 'none' };
}

interface ThemeRootProps {
  /** The palette for the whole app (EXPO_PUBLIC_FINNIT_THEME, or an admin's preview). */
  theme: AppTheme;
  children: React.ReactNode;
}

/**
 * Wraps the app: provides the palette's tokens to every className (the
 * same names as the web's CSS variables) and paints the app background,
 * including Glass's soft blobs. Screens and wrappers must not paint
 * `bg-background` over it.
 */
export function ThemeRoot({ theme, children }: ThemeRootProps) {
  const scheme: ColorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const resolved = THEMES[theme][scheme];
  const value = React.useMemo<AppThemeValue>(
    () => ({ theme, scheme, tokens: withTints(resolved.tokens) }),
    [theme, scheme, resolved],
  );

  return (
    <AppThemeContext.Provider value={value}>
      <VariableContextProvider value={value.tokens}>
        <View style={[styles.root, { backgroundColor: resolved.tokens['--background'] }]}>
          {resolved.blobs.length > 0 ? <AppBackground blobs={resolved.blobs} /> : null}
          {children}
        </View>
      </VariableContextProvider>
    </AppThemeContext.Provider>
  );
}

/** CSS `radial-gradient(rx ry at cx cy, color α 0%, transparent 70%)`, in SVG. */
function AppBackground({ blobs }: { blobs: BackgroundBlob[] }) {
  const { width, height } = useWindowDimensions();
  return (
    <Svg style={StyleSheet.absoluteFill} width={width} height={height} pointerEvents="none">
      <Defs>
        {blobs.map((blob, index) => (
          <RadialGradient
            key={index}
            id={`blob-${index}`}
            gradientUnits="userSpaceOnUse"
            cx={blob.cx * width}
            cy={blob.cy * height}
            rx={blob.rx * width}
            ry={blob.ry * height}
            fx={blob.cx * width}
            fy={blob.cy * height}
          >
            <Stop offset="0" stopColor={blob.color} stopOpacity={blob.opacity} />
            <Stop offset="0.7" stopColor={blob.color} stopOpacity={0} />
          </RadialGradient>
        ))}
      </Defs>
      {blobs.map((_, index) => (
        <Rect key={index} x={0} y={0} width={width} height={height} fill={`url(#blob-${index})`} />
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
