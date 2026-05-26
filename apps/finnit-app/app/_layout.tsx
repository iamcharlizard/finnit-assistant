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

import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { graphqlClient } from '@/lib/graphql/client';

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
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="(app)" options={{ animation: 'none' }} />
            <Stack.Screen name="+not-found" options={{ headerShown: true }} />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </AuthProvider>
    </Provider>
  );
}
