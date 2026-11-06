'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { CalendarSearch, Inbox, SearchX } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { LabelSm } from '@finnit/ui/components/ui/typography';
import { toast } from '@finnit/ui/components/ui/toaster';
import { cn } from '@finnit/ui/lib/utils';

import { EmptyState } from '@/components/finance/empty-state';
import { TransactionAliasDialog } from '@/components/transaction-detail/transaction-alias-dialog';
import { ConvertTransferDialog } from '@/components/transfers/convert-transfer-dialog';
import { useTransactionPages } from '@/hooks/use-transaction-pages';
import { monthName, type DayKey } from '@/lib/finance/dates';
import { formatMoney } from '@/lib/finance/money';
import { groupByDay } from '@/lib/finance/transactions';
import type { ApiCategory } from '@/lib/finance/types';
import {
  hasFilters,
  historyHref,
  monthLinks,
  withPeriod,
  type HistoryFilters,
} from '@/lib/history/filters';
import {
  dayNet,
  type HistoryRow as Row,
  type TransactionPage,
} from '@/lib/history/view';
import { HistoryRow } from './history-row';

/** Transactions grouped by day, with "Cargar más" and the row actions. */
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
  const router = useRouter();
  const [renaming, setRenaming] = React.useState<Row | null>(null);
  const [converting, setConverting] = React.useState<Row | null>(null);
  const groups = React.useMemo(
    () => groupByDay(rows, today, locale),
    [rows, today, locale],
  );
  const links = monthLinks(filters, today);
  const previous = links
    ? {
        href: historyHref(withPeriod(filters, links.prev), today),
        label: t('history.previousMonth', {
          month: monthName(links.prev, locale),
        }),
      }
    : null;

  const dialogs = (
    <>
      {renaming ? (
        <TransactionAliasDialog
          transactionId={renaming.id}
          current={renaming.alias}
          original={renaming.original}
          onClose={() => setRenaming(null)}
          onSaved={(removed) => {
            setRenaming(null);
            toast.success(
              t(
                removed
                  ? 'transaction.toasts.nameRemoved'
                  : 'transaction.toasts.renamed',
              ),
            );
            router.refresh();
          }}
        />
      ) : null}
      {converting?.convert ? (
        <ConvertTransferDialog
          source={converting.convert}
          onClose={() => setConverting(null)}
          onConverted={() => {
            setConverting(null);
            toast.success(t('transfers.convert.done'));
            router.refresh();
          }}
        />
      ) : null}
    </>
  );

  if (rows.length === 0) {
    if (filters.search && filters.period !== 'all') {
      return (
        <EmptyState
          icon={SearchX}
          title={t('history.noResultsTitle')}
          description={t('history.searchOtherMonths')}
          action={{
            href: historyHref(withPeriod(filters, 'all'), today),
            label: t('history.searchAllTime'),
          }}
        />
      );
    }
    if (hasFilters(filters)) {
      return (
        <EmptyState
          icon={SearchX}
          title={t('history.noResultsTitle')}
          description={t('history.noResultsDescription')}
        />
      );
    }
    if (previous) {
      return (
        <EmptyState
          icon={CalendarSearch}
          title={t('history.emptyMonthTitle')}
          description={t('history.emptyMonthDescription')}
          action={previous}
        />
      );
    }
    return (
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
      {groups.map((group) => {
        const net = dayNet(group.rows);
        return (
          <section key={group.day} className="mb-8">
            <div className="mb-3 flex items-baseline justify-between gap-3 px-1">
              <LabelSm as="h2" className="block">
                {group.heading}
              </LabelSm>
              {net && net.amount !== 0 ? (
                <span
                  className={cn(
                    'text-xs font-semibold tabular-nums',
                    net.amount > 0 ? 'text-income' : 'text-on-surface-variant',
                  )}
                >
                  {formatMoney(net.amount, net.currency, locale, {
                    sign: 'always',
                  })}
                </span>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              {group.rows.map((row) => (
                <HistoryRow
                  key={row.id}
                  row={row}
                  onRename={() => setRenaming(row)}
                  onConvert={() => setConverting(row)}
                />
              ))}
            </div>
          </section>
        );
      })}
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
      ) : previous ? (
        <Button variant="outline" className="w-full" asChild>
          <Link href={previous.href}>{previous.label}</Link>
        </Button>
      ) : null}
      {dialogs}
    </div>
  );
}
