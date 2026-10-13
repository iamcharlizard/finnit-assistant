import { View } from 'react-native';
import { Slot, usePathname } from 'expo-router';
import { BottomNavBar } from '@/components/navigation/bottom-nav-bar';

/** Full-screen flows inside the app group that must not show the tab bar. */
const ROUTES_WITHOUT_NAV = new Set(['/connect-bank']);

export default function AppLayout() {
  const pathname = usePathname();

  return (
    <View style={{ flex: 1 }}>
      <Slot />
      {ROUTES_WITHOUT_NAV.has(pathname) ? null : <BottomNavBar />}
    </View>
  );
}
