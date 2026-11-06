import '../global.css';

import {
  useFonts,
  Ubuntu_400Regular,
  Ubuntu_500Medium,
  Ubuntu_700Bold,
} from '@expo-google-fonts/ubuntu';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { Provider } from 'urql';

import { ThemeRoot } from '@finnit/ui-native/theme/theme-root';

import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { graphqlClient } from '@/lib/graphql/client';
import { APP_THEME } from '@/lib/theme/app-theme';

export default function RootLayout() {
  const [loaded] = useFonts({
    Ubuntu: Ubuntu_400Regular,
    'Ubuntu Medium': Ubuntu_500Medium,
    'Ubuntu Bold': Ubuntu_700Bold,
  });

  if (!loaded) {
    return null;
  }

  return (
    <Provider value={graphqlClient}>
      <AuthProvider>
        <ThemeProvider>
          <ThemeRoot theme={APP_THEME}>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="(app)" options={{ animation: 'none' }} />
            <Stack.Screen name="+not-found" options={{ headerShown: true }} />
          </Stack>
          </ThemeRoot>
          <StatusBar style="auto" />
        </ThemeProvider>
      </AuthProvider>
    </Provider>
  );
}
