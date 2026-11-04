'use client';

import { useTranslations } from 'next-intl';

import { PopularCategoriesCard } from '@finnit/ui/components/finance/popular-categories-card';

import { HistoryFilters } from '@/components/history/history-filters';
import { HistoryList } from '@/components/history/history-list';
import { PageHeader } from '@/components/page-header';
import {
  historyQuery,
  type HistoryFilters as Filters,
} from '@/lib/history/filters';
import type { HistoryData } from '@/lib/history/load';

export function HistoryScreen({
  data,
  filters,
}: {
  data: HistoryData;
  filters: Filters;
}) {
  const t = useTranslations('history');
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <div className="grid gap-6 @3xl:grid-cols-3">
        <div className="min-w-0 @3xl:col-span-2">
          <HistoryFilters
            filters={filters}
            accounts={data.accounts}
            categories={data.categoryOptions}
          />

          {/* New filters → new first page from the server: start the list over. */}
          <HistoryList
            key={historyQuery(filters)}
            initial={data.page}
            filters={filters}
            categories={data.categories}
            today={data.today}
          />
        </div>

        {data.topCategories.rows.length > 0 ? (
          <aside className="flex flex-col gap-4">
            <PopularCategoriesCard
              title={data.topCategories.title}
              categories={data.topCategories.rows}
            />
          </aside>
        ) : null}
      </div>
    </div>
  );
}
