'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import {
  ToggleGroup,
  ToggleGroupItem,
} from '@finnit/ui/components/ui/toggle-group';
import { cn } from '@finnit/ui/lib/utils';

import {
  monthChoices,
  periodRange,
  type CardMovementsMode,
  type CardRange,
} from '@finnit/core/accounts/card-movements';
import { todayKey } from '@finnit/core/finance/dates';
import { useLocalizer } from '@/lib/i18n/client';
import { CardPeriods } from './card-periods';
import { CardRangeMovements } from './card-range-movements';

const MONTHS = 12;

/**
 * A credit card's "Movimientos": by billing cycle (de corte a corte, with
 * what the cycle owes and was paid) or by calendar month, and the
 * movements of the one picked.
 */
export function CardMovementsTab({
  accountId,
  balanceKey,
  creditCardIds,
  onChanged,
}: {
  accountId: string;
  /** Changes with the card's balance: the cycles are asked again. */
  balanceKey: string;
  creditCardIds: ReadonlyArray<string>;
  onChanged: () => void;
}) {
  const t = useTranslations('accounts.cardMovements');
  const l = useLocalizer();
  const [mode, setMode] = React.useState<CardMovementsMode>('period');
  const [periodRangeShown, setPeriodRange] = React.useState<CardRange | null>(
    null,
  );
  const months = React.useMemo(() => monthChoices(todayKey(), MONTHS, l), [l]);
  const [month, setMonth] = React.useState(months[0]!.key);
  const monthRange = months.find((m) => m.key === month)?.range ?? null;
  const range = mode === 'period' ? periodRangeShown : monthRange;

  return (
    <div className="flex flex-col gap-4">
      <ToggleGroup
        type="single"
        value={mode}
        onValueChange={(value) => value && setMode(value as CardMovementsMode)}
        aria-label={t('modeLabel')}
        className="self-start"
      >
        <ToggleGroupItem value="period">{t('byPeriod')}</ToggleGroupItem>
        <ToggleGroupItem value="month">{t('byMonth')}</ToggleGroupItem>
      </ToggleGroup>

      {mode === 'period' ? (
        <CardPeriods
          key={balanceKey}
          accountId={accountId}
          onShown={(period) => setPeriodRange(periodRange(period))}
        />
      ) : (
        <div
          role="tablist"
          aria-label={t('byMonth')}
          className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
        >
          {months.map((choice) => {
            const active = choice.key === month;
            return (
              <button
                key={choice.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setMonth(choice.key)}
                className={cn(
                  'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap capitalize outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                  active
                    ? 'border-brand/40 bg-brand/10 text-brand-ink'
                    : 'border-glass-border text-on-surface-variant hover:bg-muted',
                )}
              >
                {choice.label}
              </button>
            );
          })}
        </div>
      )}

      {range ? (
        <section
          aria-labelledby="card-range-movements"
          className="flex flex-col gap-3"
        >
          <h2
            id="card-range-movements"
            className="text-base font-bold text-on-background"
          >
            {t('title')}
          </h2>
          <CardRangeMovements
            accountId={accountId}
            range={range}
            creditCardIds={creditCardIds}
            onChanged={onChanged}
          />
        </section>
      ) : null}
    </div>
  );
}
