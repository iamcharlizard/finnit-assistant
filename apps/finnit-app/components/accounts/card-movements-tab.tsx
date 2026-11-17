import * as React from 'react';
import { useTranslations } from 'use-intl';

import { monthChoices, periodRange, type CardMovementsMode, type CardRange } from '@finnit/core/accounts/card-movements';
import { todayKey } from '@finnit/core/finance/dates';
import { cn } from '@finnit/ui-native/lib/utils';
import { TwPressable, TwScrollView, TwView } from '@finnit/ui-native/lib/tw';
import { Segmented } from '@finnit/ui-native/components/ui/segmented';
import { Text } from '@finnit/ui-native/components/ui/text';

import { CardPeriods } from '@/components/accounts/card-periods';
import { CardRangeMovements } from '@/components/accounts/card-range-movements';
import { useLocalizer } from '@/lib/i18n/i18n-provider';

const MONTHS = 12;

/** A card's "Movimientos": by billing cycle or by calendar month, and the movements of the one picked. */
export function CardMovementsTab({
  accountId,
  balanceKey,
  terms,
}: {
  accountId: string;
  /** Changes with the card's balance: the cycles are asked again. */
  balanceKey: string;
  terms: { statementDay: number | null; paymentDueDay: number | null; interestRateAnnual: number | null };
}) {
  const t = useTranslations('accounts.cardMovements');
  const l = useLocalizer();
  const [mode, setMode] = React.useState<CardMovementsMode>('period');
  const [periodShown, setPeriodShown] = React.useState<CardRange | null>(null);
  const months = React.useMemo(() => monthChoices(todayKey(), MONTHS, l), [l]);
  const [month, setMonth] = React.useState(months[0]!.key);
  const range = mode === 'period' ? periodShown : (months.find((m) => m.key === month)?.range ?? null);

  return (
    <TwView className="gap-4">
      <Segmented
        accessibilityLabel={t('modeLabel')}
        options={[
          { value: 'period', label: t('byPeriod') },
          { value: 'month', label: t('byMonth') },
        ]}
        value={mode}
        onValueChange={(next: CardMovementsMode) => setMode(next)}
      />
      {mode === 'period' ? (
        <CardPeriods key={balanceKey} accountId={accountId} terms={terms} onShown={(period) => setPeriodShown(periodRange(period))} />
      ) : (
        <TwScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-1">
          {months.map((choice) => {
            const active = choice.key === month;
            return (
              <TwPressable
                key={choice.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setMonth(choice.key)}
                className={cn('rounded-full border px-3 py-1.5', active ? 'border-brand-40 bg-brand-10' : 'border-glass-border')}
              >
                <Text weight="medium" className={cn('text-xs capitalize', active ? 'text-brand-ink' : 'text-on-surface-variant')}>
                  {choice.label}
                </Text>
              </TwPressable>
            );
          })}
        </TwScrollView>
      )}
      {range ? (
        <TwView className="gap-3">
          <Text accessibilityRole="header" weight="bold" className="text-base">
            {t('title')}
          </Text>
          <CardRangeMovements accountId={accountId} range={range} />
        </TwView>
      ) : null}
    </TwView>
  );
}
