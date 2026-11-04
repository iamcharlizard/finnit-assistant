'use client';

import { useLocale, useTranslations } from 'next-intl';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  History,
  Sunrise,
  Sunset,
} from 'lucide-react';

import { Badge } from '@finnit/ui/components/ui/badge';
import { Button } from '@finnit/ui/components/ui/button';
import { DatePicker } from '@finnit/ui/components/ui/date-picker';

import type {
  BalanceTimeline,
  DayTimeline,
} from '@/lib/accounts/balance-history';
import type { DayKey } from '@/lib/finance/dates';
import { AccountStat } from './account-stat';

/**
 * Which day the detail shows: one day back or forward, any day from the
 * calendar, or back to today.
 */
export function BalanceDayNav({
  timeline,
  onDay,
}: {
  timeline: DayTimeline;
  /** null = today. */
  onDay: (day: DayKey | null) => void;
}) {
  const t = useTranslations('accounts.balanceDay');
  const locale = useLocale();
  const { today } = timeline;
  const go = (day: DayKey | null) => onDay(day && day < today ? day : null);

  return (
    <div className="flex flex-wrap items-center gap-2 px-1">
      <div className="flex min-w-0 flex-1 items-center gap-2 @3xl:flex-none">
        <Button
          variant="outline"
          size="icon"
          onClick={() => go(timeline.previousDay)}
          aria-label={t('previous')}
        >
          <ChevronLeft aria-hidden />
        </Button>
        <DatePicker
          aria-label={t('pick')}
          value={timeline.day}
          max={today}
          locale={locale}
          // "3 nov 2026": fits next to the arrows on phones.
          displayFormat="PP"
          onChange={(day) => day && go(day)}
          className="min-w-0 max-w-64 flex-1"
        />
        <Button
          variant="outline"
          size="icon"
          disabled={!timeline.nextDay}
          onClick={() => timeline.nextDay && go(timeline.nextDay)}
          aria-label={t('next')}
        >
          <ChevronRight aria-hidden />
        </Button>
      </div>
      {timeline.isToday ? (
        <Badge variant="muted">{t('today')}</Badge>
      ) : (
        <>
          <Badge variant="highlight">{t('historical')}</Badge>
          <Button variant="ghost" size="sm" onClick={() => go(null)}>
            {t('backToToday')}
          </Button>
        </>
      )}
    </div>
  );
}

/** Shown while a past day is on screen: these are not today's figures. */
export function HistoricalNotice({
  timeline,
  onToday,
}: {
  timeline: DayTimeline;
  onToday: () => void;
}) {
  const t = useTranslations('accounts.balanceDay');
  return (
    <section
      role="status"
      className="flex flex-wrap items-start gap-3 rounded-card border border-highlight/25 bg-highlight/5 p-4"
    >
      <History aria-hidden className="mt-0.5 size-5 shrink-0 text-highlight" />
      <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm text-on-background">
        <p className="font-bold">
          {t('noticeTitle', { date: timeline.dayLabel })}
        </p>
        <p className="text-on-surface-variant">{t('noticeBody')}</p>
        {timeline.complete ? null : (
          <p className="text-on-surface-variant">{t('incomplete')}</p>
        )}
      </div>
      <Button variant="secondary" size="sm" onClick={onToday}>
        {t('backToToday')}
      </Button>
    </section>
  );
}

/** The chosen day's balance at its start and end, and what moved it. */
export function BalanceDayStats({ timeline }: { timeline: BalanceTimeline }) {
  const t = useTranslations('accounts.balanceDay');
  const debt = timeline.isCredit ? 'Debt' : '';
  return (
    <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-4">
      <AccountStat
        icon={Sunrise}
        label={t(`opening${debt}`)}
        value={timeline.opening}
        muted={!timeline.complete}
      />
      <AccountStat
        icon={Sunset}
        label={t(`closing${debt}`)}
        value={timeline.closing}
        hint={t('movements', { count: timeline.movements })}
        muted={!timeline.complete}
      />
      <AccountStat
        icon={ArrowDownLeft}
        label={t('inflow')}
        value={timeline.inflow}
      />
      <AccountStat
        icon={ArrowUpRight}
        label={t('outflow')}
        value={timeline.outflow}
      />
    </div>
  );
}
