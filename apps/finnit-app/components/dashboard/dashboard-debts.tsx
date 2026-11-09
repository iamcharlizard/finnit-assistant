import * as React from 'react';
import { useTranslations } from 'use-intl';

import { buildDebtInsightsView } from '@finnit/core/debts/insights-view';
import type { ApiDebtInsights } from '@finnit/core/debts/types';
import { DEBTS_PATH } from '@finnit/core/debts/view';
import type { DayKey } from '@finnit/core/finance/dates';
import { TwView } from '@finnit/ui-native/lib/tw';
import { Progress } from '@finnit/ui-native/components/ui/progress';
import { SectionHeading } from '@finnit/ui-native/components/ui/section-heading';
import { Text } from '@finnit/ui-native/components/ui/text';

import { BalanceProjectionChart } from '@/components/debts/insights/balance-projection-chart';
import { DebtTypeBars } from '@/components/debts/insights/debt-type-bars';
import { TextLink } from '@/components/finance/text-link';
import { useLocalizer } from '@/lib/i18n/i18n-provider';
import { MASKED_AMOUNT } from '@finnit/core/finance/mask';

function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <TwView className="gap-0.5">
      <Text className="text-xs text-on-surface-variant">{label}</Text>
      <Text weight="bold" className="text-2xl" style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
      {note ? <Text className="text-xs text-on-surface-variant">{note}</Text> : null}
    </TwView>
  );
}

/**
 * Debts at a glance on the home screen: what is owed, how much is paid,
 * the monthly payments with their share of income, and the two charts.
 * Card MSI plans are left out, as on the web.
 */
export function DashboardDebts({
  insights,
  today,
  hidden = false,
}: {
  insights: ApiDebtInsights;
  today: DayKey;
  /** Amounts hidden: figures masked and the charts left out. */
  hidden?: boolean;
}) {
  const l = useLocalizer();
  const t = useTranslations('dashboard.debts');
  const ti = useTranslations('debts.insights');
  const built = React.useMemo(
    () => buildDebtInsightsView(insights, { today, includeMsi: false }, l),
    [insights, today, l],
  );
  const view = hidden ? { ...built, current: MASKED_AMOUNT, paid: MASKED_AMOUNT, monthly: MASKED_AMOUNT } : built;
  return (
    <TwView>
      <SectionHeading title={t('title')} action={<TextLink href={DEBTS_PATH} label={t('seeAll')} />} />
      <TwView className="gap-3">
        <TwView className="gap-3 rounded-card border border-outline bg-surface p-4">
          <TwView className="gap-4">
            <Figure label={ti('current')} value={view.current} />
            <Figure label={ti('paidSoFar')} value={view.paid} />
            <Figure
              label={t('monthly')}
              value={view.monthly}
              note={
                view.load
                  ? t('load', { percent: view.load.percent, level: ti(`loadLevels.${view.load.level}`) })
                  : t('noIncome')
              }
            />
          </TwView>
          <Progress
            value={view.paidPercent}
            indicatorColor="var(--chart-1)"
            accessibilityLabel={ti('currentVsTotal', { percent: view.paidPercent })}
          />
          <Text className="text-xs text-on-surface-variant">{ti('currentVsTotal', { percent: view.paidPercent })}</Text>
        </TwView>
        {hidden ? null : (
          <>
            <DebtTypeBars bars={view.types} />
            <BalanceProjectionChart points={view.projection} paidOffLabel={view.paidOffLabel} />
          </>
        )}
      </TwView>
    </TwView>
  );
}
