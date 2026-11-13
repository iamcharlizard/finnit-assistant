'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { PartyPopper, Shapes, Tags } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';

import { AutoCategorizeButton } from '@/components/categorize/auto-categorize-button';
import { CategorizeList } from '@/components/categorize/categorize-list';
import { DuplicateSuggestionsPanel } from '@/components/duplicates/duplicate-suggestions-panel';
import { EmptyState } from '@/components/finance/empty-state';
import { AccountBalanceCard } from '@/components/history/account-balance-card';
import { HistoryFilters } from '@/components/history/history-filters';
import { HistoryList } from '@/components/history/history-list';
import { HistoryMonth } from '@/components/history/history-month';
import { TopCategoriesCard } from '@/components/history/top-categories-card';
import { useStickyTops } from '@/components/history/use-sticky-tops';
import { PageHeader } from '@/components/page-header';
import { TransferSuggestionsPanel } from '@/components/transfers/transfer-suggestions-panel';
import {
  historyHref,
  historyQuery,
  toApiFilters,
  withPeriod,
  type HistoryFilters as Filters,
} from '@finnit/core/history/filters';
import type { HistoryData } from '@/lib/history/load';

/**
 * "Movimientos": the history and, with "Por clasificar", the movements
 * left without a category to categorize them (one by one, in bulk or with
 * the AI). Possible duplicates and transfers to review sit on top.
 */
export function HistoryScreen({
  data,
  filters,
}: {
  data: HistoryData;
  filters: Filters;
}) {
  const t = useTranslations('history');
  const tc = useTranslations('categorize');
  const router = useRouter();
  const root = React.useRef<HTMLDivElement>(null);
  useStickyTops(root);
  const query = historyQuery(filters, data.today);
  const reviewFilters = React.useMemo(() => toApiFilters(filters), [filters]);

  return (
    <div ref={root} className="flex flex-col gap-6">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/settings/categories">
                <Shapes aria-hidden /> {tc('categoriesLink')}
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/settings/aliases">
                <Tags aria-hidden /> {tc('aliasesLink')}
              </Link>
            </Button>
            <AutoCategorizeButton />
          </>
        }
      />
      <div className="grid gap-6 @3xl:grid-cols-3">
        <div className="min-w-0 @3xl:col-span-2">
          <DuplicateSuggestionsPanel />
          <TransferSuggestionsPanel
            suggestions={data.transferSuggestions.rows}
            total={data.transferSuggestions.total}
            categories={data.pickable}
          />
          <HistoryFilters
            filters={filters}
            accounts={data.accounts}
            categories={data.categoryOptions}
            today={data.today}
            aliasName={data.aliasName}
            reviewCount={data.reviewCount}
          />
          {/* Narrow screens: the account's balance before its movements. */}
          {data.account ? (
            <div className="mb-6 @3xl:hidden">
              <AccountBalanceCard card={data.account} />
            </div>
          ) : null}

          {/* New filters → new first page from the server: start the list over. */}
          {data.reviewPage ? (
            <CategorizeList
              key={`${query}:${data.reviewPage.totalCount}:${data.reviewPage.transactions[0]?.id ?? ''}`}
              initial={data.reviewPage}
              filters={reviewFilters}
              categories={data.pickable}
              today={data.today}
              onChange={() => router.refresh()}
              empty={
                <EmptyState
                  icon={PartyPopper}
                  title={tc('empty.uncategorizedTitle')}
                  description={tc('empty.uncategorizedDescription')}
                  action={
                    filters.period !== 'all' && !filters.from && !filters.to
                      ? {
                          href: historyHref(
                            withPeriod(filters, 'all'),
                            data.today,
                          ),
                          label: tc('empty.seeAllTime'),
                        }
                      : undefined
                  }
                />
              }
            />
          ) : (
            <HistoryList
              key={query}
              initial={data.page}
              filters={filters}
              categories={data.categories}
              creditCardIds={data.creditCardIds}
              today={data.today}
            />
          )}
        </div>

        {/*
          From @3xl: the month on top of the aside (below, the toolbar has
          it), the account the list is filtered by, then the top categories.
        */}
        <aside className="flex flex-col gap-4 empty:hidden @3xl:sticky @3xl:top-[var(--history-top,6rem)] @3xl:self-start">
          <MonthCard filters={filters} today={data.today} />
          {data.account ? (
            <div className="hidden @3xl:block">
              <AccountBalanceCard card={data.account} />
            </div>
          ) : null}
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
