import { useTranslations } from 'use-intl';

import type { DashboardView } from '@finnit/core/dashboard/view';
import { TwView } from '@finnit/ui-native/lib/tw';
import { BalanceCard } from '@finnit/ui-native/components/finance/balance-card';
import { Text } from '@finnit/ui-native/components/ui/text';

/** Money available, card debt and the net of all accounts. */
export function BalanceSummary({ balance }: { balance: NonNullable<DashboardView['balance']> }) {
  const t = useTranslations('dashboard.balance');
  return (
    <BalanceCard.Root>
      <BalanceCard.Header label={t('available')} amount={balance.available} />
      <TwView className="flex-row gap-3">
        {balance.creditDebt ? (
          <TwView className="flex-1">
            <Text className="text-xs text-on-surface-variant">{t('creditDebt')}</Text>
            <Text weight="bold" className="text-sm text-expense">
              {balance.creditDebt}
            </Text>
          </TwView>
        ) : null}
        <TwView className="flex-1">
          <Text className="text-xs text-on-surface-variant">{t('net')}</Text>
          <Text weight="bold" className="text-sm text-on-background">
            {balance.net}
          </Text>
        </TwView>
      </TwView>
      <BalanceCard.Footer className="flex-wrap justify-start gap-2">
        <Text className="text-xs text-on-surface-variant">{t('accounts', { count: balance.accountCount })}</Text>
        {balance.otherCurrencies.length > 0 ? (
          <Text className="text-xs text-on-surface-variant">
            {t('alsoIn', { list: balance.otherCurrencies.join(' · ') })}
          </Text>
        ) : null}
      </BalanceCard.Footer>
    </BalanceCard.Root>
  );
}
