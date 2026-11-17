import { useTranslations } from 'use-intl';
import { PieChart } from 'lucide-react-native';

import type { CreditUsageView } from '@finnit/core/accounts/credit-usage';
import { TwView } from '@finnit/ui-native/lib/tw';
import { useColor } from '@finnit/ui-native/theme/theme-root';
import { Card } from '@finnit/ui-native/components/ui/card';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Text } from '@finnit/ui-native/components/ui/text';

const ONE_OFF = 'var(--chart-1)';
const INSTALLMENTS = 'var(--chart-2)';
const tabular = { fontVariant: ['tabular-nums' as const] };

/**
 * "Crédito utilizado", split (the web's CreditUsageCard): one-off spending
 * and installments still to bill, as a bar with both amounts.
 */
export function CreditUsageCard({ usage }: { usage: CreditUsageView }) {
  const t = useTranslations('accounts.creditUsage');
  const color = useColor();
  const part = (label: string, amount: string, swatch: string, extra?: string) => (
    <TwView className="flex-1 gap-0.5">
      <TwView className="flex-row items-center gap-1.5">
        <TwView className="size-2 rounded-full" style={{ backgroundColor: color(swatch) }} />
        <Text className="text-xs text-on-surface-variant">{label}</Text>
      </TwView>
      <Text weight="bold" className="text-lg" style={tabular}>
        {amount}
      </Text>
      {extra ? <Text className="text-xs text-on-surface-variant">{extra}</Text> : null}
    </TwView>
  );
  return (
    <Card className="gap-3 rounded-[20px] p-[18px]">
      <TwView className="flex-row items-center gap-2">
        <Icon icon={PieChart} size={16} color="--brand-ink" />
        <Text weight="medium" className="text-[11px] uppercase tracking-[0.15em] text-on-surface-variant">
          {t('title')}
        </Text>
      </TwView>
      <TwView
        accessible
        accessibilityLabel={`${t('oneOff')}: ${usage.oneOff}. ${t('installments')}: ${usage.installments}`}
        className="h-3 flex-row gap-[2px] overflow-hidden rounded-full bg-track"
      >
        {usage.oneOffPercent > 0 ? <TwView style={{ flexGrow: usage.oneOffPercent, flexBasis: 0, backgroundColor: color(ONE_OFF) }} /> : null}
        {usage.installmentsPercent > 0 ? (
          <TwView style={{ flexGrow: usage.installmentsPercent, flexBasis: 0, backgroundColor: color(INSTALLMENTS) }} />
        ) : null}
      </TwView>
      <TwView className="flex-row gap-3">
        {part(t('oneOff'), usage.oneOff, ONE_OFF)}
        {part(t('installments'), usage.installments, INSTALLMENTS, t('plans', { count: usage.plans }))}
      </TwView>
      <Text className="text-xs text-on-surface-variant">{t('hint')}</Text>
    </Card>
  );
}
