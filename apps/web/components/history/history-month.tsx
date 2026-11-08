'use client';

import { useLocale } from 'next-intl';

import { MonthSwitcher } from '@/components/finance/month-switcher';
import { monthLabel, type DayKey } from '@finnit/core/finance/dates';
import {
  historyHref,
  monthLinks,
  withPeriod,
  type HistoryFilters,
} from '@finnit/core/history/filters';

/**
 * "‹ Noviembre 2026 ›" for the history, keeping the other filters; nothing
 * while it shows the whole history or a range (the dates chip says so).
 */
export function HistoryMonth({
  filters,
  today,
}: {
  filters: HistoryFilters;
  today: DayKey;
}) {
  const locale = useLocale();
  const links = monthLinks(filters, today);
  if (!links || filters.period === 'all') return null;
  return (
    <MonthSwitcher
      as="h2"
      compact
      label={monthLabel(filters.period, locale)}
      prevHref={historyHref(withPeriod(filters, links.prev), today)}
      nextHref={
        links.next ? historyHref(withPeriod(filters, links.next), today) : null
      }
    />
  );
}
