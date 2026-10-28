'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Inbox, SearchX } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { LabelSm } from '@finnit/ui/components/ui/typography';

import { EmptyState } from '@/components/finance/empty-state';
import { TransactionStatusRow } from '@/components/finance/transaction-status-row';
import { useTransactionPages } from '@/hooks/use-transaction-pages';
import type { DayKey } from '@/lib/finance/dates';
import { groupByDay } from '@/lib/finance/transactions';
import type { ApiCategory } from '@/lib/finance/types';
import { hasFilters, type HistoryFilters } from '@/lib/history/filters';
import type { TransactionPage } from '@/lib/history/view';

/** Transactions grouped by day, with "Cargar más". */
export function HistoryList({
  initial,
  filters,
  categories,
  today,
}: {
  initial: TransactionPage;
  filters: HistoryFilters;
  categories: ApiCategory[];
  today: DayKey;
}) {
  const { rows, totalCount, hasNextPage, loading, error, loadMore } =
    useTransactionPages(initial, filters, categories);
  const t = useTranslations();
  const locale = useLocale();
  const groups = React.useMemo(
    () => groupByDay(rows, today, locale),
    [rows, today, locale],
  );

  if (rows.length === 0) {
    return hasFilters(filters) ? (
      <EmptyState
        icon={SearchX}
        title={t('history.noResultsTitle')}
        description={t('history.noResultsDescription')}
      />
    ) : (
      <EmptyState
        icon={Inbox}
        title={t('history.emptyTitle')}
        description={t('history.emptyDescription')}
        action={{
          href: '/settings/banks/connect',
          label: t('common.connectBank'),
        }}
      />
    );
  }

  return (
    <div>
      <p
        className="mb-4 px-1 text-xs text-on-surface-variant"
        aria-live="polite"
      >
        {t('history.count', {
          shown: String(rows.length),
          total: totalCount,
        })}
      </p>
      {groups.map((group) => (
        <section key={group.day} className="mb-8">
          <LabelSm as="h2" className="mb-3 block px-1">
            {group.heading}
          </LabelSm>
          <div className="flex flex-col gap-2">
            {group.rows.map((row) => (
              <TransactionStatusRow key={row.id} row={row} />
            ))}
          </div>
        </section>
      ))}
      {error ? (
        <p role="alert" className="mb-3 text-sm text-expense">
          {error}
        </p>
      ) : null}
      {hasNextPage ? (
        <Button
          variant="outline"
          className="w-full"
          onClick={loadMore}
          disabled={loading}
        >
          {loading ? t('common.loading') : t('common.loadMore')}
        </Button>
      ) : null}
    </div>
  );
}
