import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/contexts/AuthContext';

/** Detail screens pushed over the tabs (declared, as Expo Router 58 expects). */
const PUSHED_ROUTES = [
  'transaction/[id]',
  'accounts/[accountId]',
  'planning/debts/[id]',
  'planning/goals/[goalId]',
  'statements/[id]',
  'settings/categories',
  'settings/aliases',
  'notifications',
  'connect-bank',
] as const;

/**
 * Everything behind the session. Without one, back to login (like the
 * web's proxy). The tabs show the bottom bar; detail screens push over
 * them; sheets (Más, new movement, a movement's detail) slide up.
 */
export default function AppLayout() {
  const { status } = useAuth();
  if (status === 'loading') return null;
  if (status === 'signedOut') return <Redirect href="/login" />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
      <Stack.Screen name="(tabs)" />
      {PUSHED_ROUTES.map((name) => (
        <Stack.Screen key={name} name={name} />
      ))}
      <Stack.Screen
        name="new-entry"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: [0.92],
          sheetGrabberVisible: true,
          sheetCornerRadius: 28,
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
      <Stack.Screen
        name="profile"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          sheetGrabberVisible: true,
          sheetCornerRadius: 28,
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
      <Stack.Screen
        name="privacy-unlock"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          sheetGrabberVisible: true,
          sheetCornerRadius: 28,
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
      <Stack.Screen
        name="more"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          sheetGrabberVisible: true,
          sheetCornerRadius: 28,
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
    </Stack>
  );
}
