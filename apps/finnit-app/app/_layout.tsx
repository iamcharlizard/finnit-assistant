import '../global.css';

import {
  useFonts,
  Ubuntu_400Regular,
  Ubuntu_500Medium,
  Ubuntu_700Bold,
} from '@expo-google-fonts/ubuntu';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationTheme } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useAppTheme, ThemeRoot } from '@finnit/ui-native/theme/theme-root';
import { MoneyFormatProvider } from '@finnit/ui-native/components/ui/money-input';

import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { I18nProvider } from '@/lib/i18n/i18n-provider';
import { AppearanceProvider, useAppearance } from '@/lib/theme/appearance';

export default function RootLayout() {
  const [loaded] = useFonts({
    Ubuntu: Ubuntu_400Regular,
    'Ubuntu Medium': Ubuntu_500Medium,
    'Ubuntu Bold': Ubuntu_700Bold,
  });

  if (!loaded) return null;

  return (
    <I18nProvider>
      <AuthProvider>
        <AppearanceProvider>
          <ThemedApp />
        </AppearanceProvider>
      </AuthProvider>
    </I18nProvider>
  );
}

function ThemedApp() {
  const { theme } = useAppearance();
  return (
    <ThemeRoot theme={theme}>
      <MoneyFormatProvider country="MX">
        {/* Legacy isDark context for the screens not migrated yet. */}
        <ThemeProvider>
          <Navigation />
        </ThemeProvider>
      </MoneyFormatProvider>
    </ThemeRoot>
  );
}

/**
 * Navigation paints nothing: ThemeRoot draws the app background (Glass's
 * blobs included) behind every screen.
 */
function Navigation() {
  const { scheme, tokens } = useAppTheme();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      background: 'transparent',
      card: tokens['--surface']!,
      text: tokens['--on-background']!,
      border: tokens['--outline']!,
      primary: tokens['--accent-neon']!,
    },
  };
  return (
    <NavigationTheme value={navigationTheme}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="(app)" options={{ animation: 'none' }} />
        <Stack.Screen name="+not-found" options={{ headerShown: true }} />
      </Stack>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </NavigationTheme>
  );
}
