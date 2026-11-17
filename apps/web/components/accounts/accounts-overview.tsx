'use client';

import { useTranslations } from 'next-intl';
import { ChartLine, CreditCard, LayoutList, Wallet } from 'lucide-react';

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@finnit/ui/components/ui/tabs';

import { useUrlTab } from '@/components/use-url-tab';
import type { OverviewData } from '@/lib/accounts/load';
import type { DayKey } from '@finnit/core/finance/dates';
import { ACCOUNTS_TABS } from '@finnit/core/recurring/tabs';
import { AccountBalanceList } from './account-balance-list';
import { AccountStat } from './account-stat';
import { BalanceDayNav, HistoricalNotice } from './balance-day';
import { DailyBalanceChart } from './daily-balance-chart';

const TAB = 'flex-1 px-2 sm:flex-none sm:px-4';

/**
 * Every account together (none chosen), in two tabs. Resumen: money
 * available and card debt on the chosen day, and each account's balance.
 * Analíticos: both lines day by day.
 */
export function AccountsOverview({
  overview,
  onDay,
  onSelect,
}: {
  overview: OverviewData;
  /** null = today. */
  onDay: (day: DayKey | null) => void;
  /** An account of the balance list was chosen. */
  onSelect: (id: string) => void;
}) {
  const t = useTranslations('accounts.overview');
  const [tab, changeTab] = useUrlTab(ACCOUNTS_TABS);
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

      <Tabs value={tab} onValueChange={changeTab} className="gap-4">
        <TabsList className="w-full sm:w-fit">
          <TabsTrigger value="summary" className={TAB}>
            <LayoutList aria-hidden /> {t('tabs.summary')}
          </TabsTrigger>
          <TabsTrigger value="analytics" className={TAB}>
            <ChartLine aria-hidden /> {t('tabs.analytics')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="flex flex-col gap-4">
          {timeline ? (
            <>
              <BalanceDayNav timeline={timeline} onDay={onDay} />
              {timeline.isToday ? null : (
                <HistoricalNotice
                  timeline={timeline}
                  onToday={() => onDay(null)}
                />
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
            </>
          ) : null}
          <AccountBalanceList groups={overview.balances} onSelect={onSelect} />
        </TabsContent>

        <TabsContent value="analytics" className="flex flex-col gap-4">
          {timeline ? (
            <>
              <BalanceDayNav timeline={timeline} onDay={onDay} />
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
        </TabsContent>
      </Tabs>
    </section>
  );
}
