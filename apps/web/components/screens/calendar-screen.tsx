'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  CalendarClock,
  CalendarDays,
  ChartColumn,
  CircleCheck,
  Landmark,
} from 'lucide-react';

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@finnit/ui/components/ui/tabs';

import { MonthProgress } from '@/components/calendar/month-progress';
import { MonthsChart } from '@/components/calendar/months-chart';
import { PaymentsCalendar } from '@/components/calendar/payments-calendar';
import { SpendingBars } from '@/components/calendar/spending-bars';
import { PageHeader } from '@/components/page-header';
import { SummaryCard } from '@/components/recurring/summary-card';
import type { CalendarData } from '@/lib/calendar/load';
import {
  CALENDAR_TABS,
  parseTab,
  withTab,
  type CalendarTab,
} from '@finnit/core/recurring/tabs';

const TEAL = '#00696e';
const GREEN = '#00a86b';
const PURPLE = '#6c72cb';
const SUMMARY_CARD = 'w-[78%] shrink-0 snap-start sm:w-auto';
const TAB = 'flex-1 px-2 sm:flex-none sm:px-4';

/**
 * "Calendario de pagos": every scheduled payment (recurring expenses,
 * loans) and the credit cards' dates on a calendar; and a summary of this
 * month and the next ones, with charts.
 */
export function CalendarScreen({
  data,
  initialTab,
}: {
  data: CalendarData;
  initialTab: CalendarTab;
}) {
  const t = useTranslations();
  const [tab, setTab] = React.useState(initialTab);
  const { summary } = data;

  // The tab lives in the URL (no navigation) so a reload keeps it.
  function changeTab(value: string) {
    const next = parseTab(CALENDAR_TABS, value);
    setTab(next);
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${withTab(CALENDAR_TABS, window.location.search, next)}`,
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t('calendar.title')}
        subtitle={t('calendar.subtitle')}
      />

      <Tabs value={tab} onValueChange={changeTab} className="gap-6">
        <TabsList
          aria-label={t('calendar.tabs.label')}
          className="w-full sm:w-fit"
        >
          <TabsTrigger value="calendar" className={TAB}>
            <CalendarDays aria-hidden /> {t('calendar.tabs.calendar')}
          </TabsTrigger>
          <TabsTrigger value="summary" className={TAB}>
            <ChartColumn aria-hidden /> {t('calendar.tabs.summary')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar">
          <PaymentsCalendar data={data.calendar} />
        </TabsContent>

        <TabsContent value="summary" className="flex flex-col gap-6">
          {/* On phones the totals scroll sideways. */}
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
            <SummaryCard
              className={SUMMARY_CARD}
              icon={CalendarClock}
              accent={TEAL}
              label={t('recurring.summary.toPay')}
              amount={summary.totals.toPay}
              detail={t('recurring.summary.toPayDetail', {
                count: summary.totals.toPayCount,
                period: summary.monthLabel,
              })}
            />
            <SummaryCard
              className={SUMMARY_CARD}
              icon={CircleCheck}
              accent={GREEN}
              label={t('recurring.summary.paid')}
              amount={summary.totals.paid}
              detail={t('recurring.summary.paidDetail', {
                count: summary.totals.paidCount,
                period: summary.monthLabel,
              })}
            />
            <SummaryCard
              className={SUMMARY_CARD}
              icon={Landmark}
              accent={PURPLE}
              label={t('recurring.summary.fixedMonthly')}
              amount={summary.totals.fixedMonthly}
              detail={t('recurring.summary.fixedMonthlyDetail', {
                count: summary.totals.activeCount,
              })}
            />
          </div>

          <div className="grid gap-6 @4xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <MonthsChart
              months={summary.months}
              hasCardEstimate={summary.hasCardEstimate}
            />
            <MonthProgress
              progress={summary.progress}
              monthLabel={summary.monthLabel}
            />
          </div>
          <div className="grid gap-6 @3xl:grid-cols-2">
            <SpendingBars
              title={t('calendar.summary.byKindTitle')}
              bars={summary.byKind}
            />
            <SpendingBars
              title={t('calendar.summary.byAccountTitle')}
              bars={summary.byAccount}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
