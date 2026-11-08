'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { HistoryFilters } from '@/components/history/history-filters';
import { HistoryList } from '@/components/history/history-list';
import { HistoryMonth } from '@/components/history/history-month';
import { TopCategoriesCard } from '@/components/history/top-categories-card';
import { useStickyTops } from '@/components/history/use-sticky-tops';
import { PageHeader } from '@/components/page-header';
import {
  historyQuery,
  type HistoryFilters as Filters,
} from '@finnit/core/history/filters';
import type { HistoryData } from '@/lib/history/load';

export function HistoryScreen({
  data,
  filters,
}: {
  data: HistoryData;
  filters: Filters;
}) {
  const t = useTranslations('history');
  const root = React.useRef<HTMLDivElement>(null);
  useStickyTops(root);
  return (
    <div ref={root} className="flex flex-col gap-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <div className="grid gap-6 @3xl:grid-cols-3">
        <div className="min-w-0 @3xl:col-span-2">
          <HistoryFilters
            filters={filters}
            accounts={data.accounts}
            categories={data.categoryOptions}
            today={data.today}
            aliasName={data.aliasName}
          />

          {/* New filters → new first page from the server: start the list over. */}
          <HistoryList
            key={historyQuery(filters, data.today)}
            initial={data.page}
            filters={filters}
            categories={data.categories}
            today={data.today}
          />
        </div>

        {/*
          From @3xl: the month on top of the aside (below, the toolbar has
          it), then the top categories.
        */}
        <aside className="flex flex-col gap-4 empty:hidden @3xl:sticky @3xl:top-[var(--history-top,6rem)] @3xl:self-start">
          <MonthCard filters={filters} today={data.today} />
          {data.topCategories.rows.length > 0 ? (
            <TopCategoriesCard data={data.topCategories} />
          ) : null}
        </aside>
      </div>
    </div>
  );
}

/** The month switcher as a card over the aside (wide screens only). */
function MonthCard({
  filters,
  today,
}: {
  filters: Filters;
  today: HistoryData['today'];
}) {
  if (filters.period === 'all' || filters.from || filters.to) return null;
  return (
    <div className="hidden justify-center rounded-card border border-glass-border bg-glass p-1.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] backdrop-blur-md @3xl:flex">
      <HistoryMonth filters={filters} today={today} />
    </div>
  );
}
