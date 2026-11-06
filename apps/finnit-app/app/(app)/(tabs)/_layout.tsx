import { View } from 'react-native';
import { Tabs, useRouter, type Href } from 'expo-router';
import { useTranslations } from 'use-intl';
import { ArrowLeftRight, CircleArrowDown, CircleArrowUp, ScanLine, Smartphone } from 'lucide-react-native';

import { BOTTOM_NAV_KEYS } from '@finnit/core/nav/sections';
import { BottomNavBar, type BottomNavTab } from '@finnit/ui-native/components/navigation/bottom-nav-bar';

import { NAV_ITEM_ICONS } from '@/lib/nav/icons';
import { useNav } from '@/lib/nav/use-nav';

/**
 * The main screens, with the floating bottom bar over them (like the web
 * below lg): Inicio, Movimientos, "+", Cuentas and "Más".
 */
export default function TabsLayout() {
  const t = useTranslations();
  const router = useRouter();
  const { entries, activeHref, moreActive } = useNav();

  const tabs = BOTTOM_NAV_KEYS.map((key): BottomNavTab => {
    const entry = entries.find((e) => e.entry.key === key)!.entry;
    return {
      key,
      label: t(`nav.short.${key}`),
      icon: NAV_ITEM_ICONS[key],
      active: entry.href === activeHref,
      onPress: () => router.navigate(entry.href as Href),
    };
  }) as [BottomNavTab, BottomNavTab, BottomNavTab];

  const newEntry = (action: string) => () =>
    router.push({ pathname: '/new-entry', params: { action } });

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        tabBar={() => null}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }}
      />
      <BottomNavBar
        label={t('nav.mainNavigation')}
        tabs={tabs}
        more={{ label: t('nav.more'), active: moreActive, onPress: () => router.push('/more') }}
        addLabel={t('nav.addTransaction')}
        closeLabel={t('common.close')}
        actions={[
          { key: 'expense', label: t('newEntry.expense'), icon: CircleArrowUp, tone: '--expense', onPress: newEntry('expense') },
          { key: 'income', label: t('newEntry.income'), icon: CircleArrowDown, tone: '--income', onPress: newEntry('income') },
          { key: 'transfer', label: t('newEntry.transfer'), icon: ArrowLeftRight, tone: '--violet-ink', onPress: newEntry('transfer') },
          { key: 'receipt', label: t('receipts.scan'), icon: ScanLine, tone: '--brand-ink', onPress: newEntry('receipt') },
          { key: 'screenshot', label: t('screenshots.import'), icon: Smartphone, tone: '--brand-ink', onPress: newEntry('screenshot') },
        ]}
      />
    </View>
  );
}
