'use client';

import { PopularCategoriesCard } from '@finnit/ui/components/finance/popular-categories-card';

import { HistoryFilters } from '@/components/history/history-filters';
import { HistoryList } from '@/components/history/history-list';
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
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="min-w-0 lg:col-span-2">
        <h1 className="mb-1 text-[32px] font-bold text-on-background">
          Historial
        </h1>
        <p className="mb-6 text-sm text-on-surface-variant">
          Revisa y filtra todos tus movimientos.
        </p>

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
        <aside className="flex flex-col gap-4 lg:pt-23">
          <PopularCategoriesCard
            title={data.topCategories.title}
            categories={data.topCategories.rows}
          />
        </aside>
      ) : null}
    </div>
  );
}
