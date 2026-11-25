import * as React from 'react';
import { View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Tabs, useRouter, type Href } from 'expo-router';
import { useTranslations } from 'use-intl';
import {
  ArrowLeftRight,
  CircleArrowDown,
  CircleArrowUp,
  CreditCardCheck,
  ScanLine,
  Smartphone,
} from 'lucide-react-native';
import { useQuery } from 'urql';

import { BOTTOM_NAV_KEYS } from '@finnit/core/nav/sections';
import {
  BottomNavBar,
  type BottomNavTab,
} from '@finnit/ui-native/components/navigation/bottom-nav-bar';
import { useTour } from '@finnit/ui-native/components/tour/tour-context';
import { TourProvider } from '@finnit/ui-native/components/tour/tour-provider';

import { NAV_ITEM_ICONS } from '@/lib/nav/icons';
import { useOnTourRequest } from '@/lib/onboarding/onboarding';
import { tourSteps } from '@/lib/onboarding/tour-steps';
import { useNav } from '@/lib/nav/use-nav';

const CREDIT_CARDS_QUERY = `query HasCreditCard { accounts(first: 1, type: credit, archived: false) { totalCount } }`;

/** Every route under (tabs): Expo Router 58 only shows the declared ones. */
const TAB_ROUTES = [
  'dashboard',
  'history',
  'accounts',
  'recurring',
  'calendar',
  'analytics',
  'settings',
  'statements',
  'transactions/categorize',
  'planning/budgets',
  'planning/debts',
  'planning/goals',
  'planning/simulator',
] as const;

/**
 * The main screens, with the floating bottom bar over them (like the web
 * below lg): Inicio, Movimientos, "+", Cuentas and "Más".
 */
export default function TabsLayout() {
  const t = useTranslations();
  const router = useRouter();
  const { entries, activeHref, moreActive } = useNav();
  // "Pago a tarjeta" joins the "+" shortcuts once there is a card to pay.
  const [{ data: cards }] = useQuery<{ accounts: { totalCount: number } }>({
    query: CREDIT_CARDS_QUERY,
    requestPolicy: 'cache-and-network',
  });
  const hasCreditCard = (cards?.accounts.totalCount ?? 0) > 0;
  const steps = React.useMemo(() => tourSteps(t), [t]);

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
    <TourProvider
      steps={steps}
      labels={{
        next: t('onboarding.next'),
        back: t('onboarding.back'),
        done: t('onboarding.done'),
        skip: t('onboarding.skip'),
        close: t('onboarding.close'),
        stepOf: (current, total) => t('onboarding.stepOf', { current, total }),
      }}
      onNavigate={(route) => router.navigate(route as Href)}
      onStepChange={() => void Haptics.selectionAsync()}
      onEnd={() => router.navigate('/dashboard')}
    >
      <TourAutostart />
      <View style={{ flex: 1 }}>
        <Tabs
          tabBar={() => null}
          screenOptions={{
            headerShown: false,
            sceneStyle: { backgroundColor: 'transparent' },
          }}
        >
          {TAB_ROUTES.map((name) => (
            <Tabs.Screen key={name} name={name} />
          ))}
        </Tabs>
        <BottomNavBar
          label={t('nav.mainNavigation')}
          tabs={tabs}
          more={{
            label: t('nav.more'),
            active: moreActive,
            onPress: () => router.push('/more'),
          }}
          addLabel={t('nav.addTransaction')}
          closeLabel={t('common.close')}
          // Two rows of three: the everyday ones next to the "+", then the rest.
          actions={[
            {
              key: 'expense',
              label: t('newEntry.expense'),
              icon: CircleArrowUp,
              tone: '--expense',
              onPress: newEntry('expense'),
            },
            {
              key: 'income',
              label: t('newEntry.income'),
              icon: CircleArrowDown,
              tone: '--income',
              onPress: newEntry('income'),
            },
            {
              key: 'transfer',
              label: t('newEntry.transfer'),
              icon: ArrowLeftRight,
              tone: '--violet-ink',
              onPress: newEntry('transfer'),
            },
            ...(hasCreditCard
              ? [
                  {
                    key: 'cardPayment',
                    label: t('newEntry.cardPayment'),
                    icon: CreditCardCheck,
                    tone: '--violet-ink' as const,
                    onPress: newEntry('cardPayment'),
                  },
                ]
              : []),
            {
              key: 'receipt',
              label: t('receipts.scan'),
              icon: ScanLine,
              tone: '--brand-ink',
              onPress: newEntry('receipt'),
            },
            {
              key: 'screenshot',
              label: t('screenshots.import'),
              icon: Smartphone,
              tone: '--brand-ink',
              onPress: newEntry('screenshot'),
            },
          ]}
        />
      </View>
    </TourProvider>
  );
}

/** Starts the tour when the welcome slides ask for it ("Ver el recorrido"). */
function TourAutostart() {
  const tour = useTour();
  useOnTourRequest(() => tour?.start());
  return null;
}
