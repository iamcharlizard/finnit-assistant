import * as React from 'react';
import { Redirect, Stack, useRouter } from 'expo-router';

import { useAuth } from '@/contexts/AuthContext';
import { decideOnboarding } from '@/lib/onboarding/onboarding';
import { AmountsVisibilityProvider } from '@/lib/privacy/amounts-visibility';
import { useWidgetSync } from '@/lib/widget/use-widget-sync';

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
  const { status, user } = useAuth();
  const router = useRouter();
  useWidgetSync();

  // First sign-in on this device: the welcome slides (then the tour),
  // checked once per user and app start.
  const checked = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (status !== 'signedIn' || !user || checked.current === user.id) return;
    if (decideOnboarding() !== 'show') {
      checked.current = user.id;
      return;
    }
    // After the tabs mount (the slides are a modal over them). Marked as
    // checked only once pushed: a re-render meanwhile tries again.
    const timer = setTimeout(() => {
      checked.current = user.id;
      router.push('/onboarding');
    }, 300);
    return () => clearTimeout(timer);
  }, [status, user, router]);

  // AnimatedSplash covers the screen meanwhile.
  if (status === 'loading') return null;
  if (status === 'signedOut') return <Redirect href="/login" />;

  return (
    <AmountsVisibilityProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent' },
        }}
      >
        <Stack.Screen name="(tabs)" />
        {PUSHED_ROUTES.map((name) => (
          <Stack.Screen key={name} name={name} />
        ))}
        <Stack.Screen
          name="new-entry"
          options={{
            presentation: 'formSheet',
            // Full height: below it iOS 26 floats the sheet off the screen's
            // edges and lifts it to full height when the keyboard opens.
            sheetAllowedDetents: [1],
            sheetGrabberVisible: true,
            sheetCornerRadius: 28,
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
        <Stack.Screen
          name="new-debt"
          options={{
            presentation: 'formSheet',
            // Full height: below it iOS 26 floats the sheet off the screen's
            // edges and lifts it to full height when the keyboard opens.
            sheetAllowedDetents: [1],
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
          name="onboarding"
          options={{
            presentation: 'fullScreenModal',
            gestureEnabled: false,
            animation: 'fade',
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
    </AmountsVisibilityProvider>
  );
}
