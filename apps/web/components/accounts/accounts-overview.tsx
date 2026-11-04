'use client';

import { useTranslations } from 'next-intl';
import { CreditCard, Wallet } from 'lucide-react';

import type { OverviewData } from '@/lib/accounts/load';
import type { DayKey } from '@/lib/finance/dates';
import { AccountMovements } from './account-movements';
import { AccountStat } from './account-stat';
import { BalanceDayNav, HistoricalNotice } from './balance-day';
import { DailyBalanceChart } from './daily-balance-chart';

/**
 * Every account together (none chosen): money available and card debt on
 * the chosen day, both lines over time and that day's movements.
 */
export function AccountsOverview({
  overview,
  onDay,
}: {
  overview: OverviewData;
  /** null = today. */
  onDay: (day: DayKey | null) => void;
}) {
  const t = useTranslations('accounts.overview');
  const { timeline } = overview;

  return (
    <section
      aria-labelledby="accounts-overview-title"
      className="flex min-w-0 flex-col gap-4"
    >
      <div className="flex flex-col gap-1 px-1">
        <h2
          id="accounts-overview-title"
          className="text-xl font-bold text-on-background"
        >
          {t('title')}
        </h2>
        {timeline ? (
          <p className="text-sm text-on-surface-variant">
            {t('subtitle', {
              count: timeline.accounts,
              currency: timeline.currency,
            })}
          </p>
        ) : null}
      </div>

      {timeline ? (
        <>
          <BalanceDayNav timeline={timeline} onDay={onDay} />
          {timeline.isToday ? null : (
            <HistoricalNotice timeline={timeline} onToday={() => onDay(null)} />
          )}
          <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-4">
            <AccountStat
              icon={Wallet}
              label={t('availableOpening')}
              value={timeline.availableOpening}
              muted={!timeline.complete}
            />
            <AccountStat
              icon={Wallet}
              label={t('availableClosing')}
              value={timeline.availableClosing}
              hint={t('movements', { count: timeline.movements })}
              muted={!timeline.complete}
            />
            {timeline.hasDebt ? (
              <>
                <AccountStat
                  icon={CreditCard}
                  label={t('debtOpening')}
                  value={timeline.debtOpening}
                  muted={!timeline.complete}
                />
                <AccountStat
                  icon={CreditCard}
                  label={t('debtClosing')}
                  value={timeline.debtClosing}
                  muted={!timeline.complete}
                />
              </>
            ) : null}
          </div>
          <DailyBalanceChart
            title={t('chartTitle')}
            days={timeline.days}
            series={[
              {
                key: 'available',
                label: t('available'),
                color: 'var(--chart-1)',
                ...timeline.available,
              },
              ...(timeline.hasDebt
                ? [
                    {
                      key: 'debt',
                      label: t('debt'),
                      color: 'var(--chart-2)',
                      ...timeline.debt,
                    },
                  ]
                : []),
            ]}
            selectedDay={timeline.day}
            completeFromLabel={timeline.completeFromLabel}
            currency={timeline.currency}
            onDay={onDay}
          />
        </>
      ) : null}

      <AccountMovements
        rows={overview.recent}
        historyHref={overview.historyHref}
        dayLabel={timeline && !timeline.isToday ? timeline.dayLabel : null}
      />
    </section>
  );
}
