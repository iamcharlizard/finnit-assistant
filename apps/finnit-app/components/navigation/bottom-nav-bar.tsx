import { TwView, TwText, TwPressable } from '../../lib/tw';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { useRouter, usePathname } from 'expo-router';
import type { SymbolViewProps } from 'expo-symbols';

type TabName = 'home' | 'analytics' | 'add' | 'cards' | 'settings';

interface TabItem {
  name: TabName;
  label: string;
  symbolName: SymbolViewProps['name'];
  route: string | null;
}

const TABS: TabItem[] = [
  { name: 'home', label: 'Home', symbolName: 'house.fill', route: '/dashboard' },
  { name: 'analytics', label: 'Analytics', symbolName: 'chart.xyaxis.line', route: '/analytics' },
  { name: 'add', label: 'Add', symbolName: 'plus.circle.fill', route: null },
  { name: 'cards', label: 'Cards', symbolName: 'creditcard.fill', route: '/cards' },
  { name: 'settings', label: 'Settings', symbolName: 'gearshape.fill', route: '/settings' },
];

const ROUTE_TO_TAB: Record<string, TabName> = {
  '/dashboard': 'home',
  '/analytics': 'analytics',
  '/cards': 'cards',
  '/settings': 'settings',
};

export function BottomNavBar() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();

  const activeTab = ROUTE_TO_TAB[pathname] ?? 'home';

  function handlePress(tab: TabItem) {
    if (tab.route === null) {
      // TODO: open "Add Transaction" modal
      return;
    }
    router.replace(tab.route as '/dashboard' | '/analytics' | '/cards' | '/settings');
  }

  return (
    <TwView
      className={`flex-row justify-around items-center px-2 border-t ${
        isDark ? 'border-outline-dark' : 'border-outline'
      }`}
      style={{
        // NW-FALLBACK: rgba glassmorphism
        backgroundColor: isDark
          ? 'rgba(18, 19, 26, 0.92)'
          : 'rgba(255, 255, 255, 0.92)',
        paddingBottom: insets.bottom + 8,
        paddingTop: 8,
        boxShadow: isDark
          ? '0 -2px 16px rgba(0,0,0,0.3)'
          : '0 -2px 16px rgba(0,0,0,0.06)',
      }}
    >
      {TABS.map((tab) => {
        const isActive = tab.name === activeTab;
        const isAddAction = tab.name === 'add';

        return (
          <TwPressable
            key={tab.name}
            className={`flex-col items-center justify-center px-3 py-1 rounded-[12px] ${
              isActive && !isAddAction
                ? isDark
                  ? 'bg-primary-dark/20'
                  : 'bg-primary/20'
                : ''
            }`}
            onPress={() => handlePress(tab)}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: isActive }}
            style={{ minWidth: 44, minHeight: 44 }}
          >
            <SymbolView
              name={tab.symbolName}
              size={isAddAction ? 28 : 22}
              tintColor={
                isActive
                  ? isDark
                    ? '#6c72cb'
                    : '#00b8c0'
                  : isDark
                  ? '#a0a0a0'
                  : '#5c6370'
              }
              accessibilityLabel=""
            />
            {!isAddAction ? (
              <TwText
                className={`text-[10px] mt-0.5 ${
                  isActive
                    ? isDark
                      ? 'text-primary-dark'
                      : 'text-primary'
                    : isDark
                    ? 'text-on-surface-variant-dark'
                    : 'text-on-surface-variant'
                }`}
                style={{ fontFamily: 'Ubuntu Medium' }}
              >
                {tab.label}
              </TwText>
            ) : null}
          </TwPressable>
        );
      })}
    </TwView>
  );
}
