import { useRouter } from 'expo-router';
import { useTranslations } from 'use-intl';

import type { DashboardView } from '@finnit/core/dashboard/view';
import { TwPressable, TwView } from '@finnit/ui-native/lib/tw';
import { BalanceCard } from '@finnit/ui-native/components/finance/balance-card';
import { Text } from '@finnit/ui-native/components/ui/text';

import { AmountsToggle } from '@/lib/privacy/amounts-visibility';

/**
 * Money available in the accounts that add up to the total, centred, with
 * the eye that hides every amount. Tapping the card opens Cuentas.
 */
export function BalanceSummary({
  balance,
}: {
  balance: NonNullable<DashboardView['balance']>;
}) {
  const t = useTranslations('dashboard.balance');
  const router = useRouter();
  return (
    <BalanceCard.Root className="p-0">
      <TwPressable
        accessibilityRole="link"
        accessibilityLabel={`${t('available')}: ${balance.available}`}
        onPress={() => router.push('/accounts')}
        className="items-center gap-1 px-6 pt-6 pb-7 active:opacity-80"
      >
        <Text
          weight="medium"
          className="text-xs tracking-widest text-on-surface-variant uppercase"
        >
          {t('available')}
        </Text>
        <Text
          weight="bold"
          numberOfLines={1}
          adjustsFontSizeToFit
          className="text-[40px] text-on-background"
          style={{ lineHeight: 48, fontVariant: ['tabular-nums'] }}
        >
          {balance.available}
        </Text>
        {balance.otherCurrencies.length > 0 ? (
          <Text numberOfLines={1} className="text-xs text-on-surface-variant">
            {t('alsoIn', { list: balance.otherCurrencies.join(' · ') })}
          </Text>
        ) : null}
      </TwPressable>
      {/* Outside the pressable so its tap doesn't open Cuentas. */}
      <TwView className="absolute top-3 right-3">
        <AmountsToggle />
      </TwView>
    </BalanceCard.Root>
  );
}
