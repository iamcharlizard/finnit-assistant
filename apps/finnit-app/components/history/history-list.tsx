import * as React from 'react';
import { useRouter } from 'expo-router';
import { useTranslations } from 'use-intl';
import { CalendarSearch, Inbox, SearchX } from 'lucide-react-native';

import { indexCategories } from '@finnit/core/finance/categories';
import { monthName, type DayKey } from '@finnit/core/finance/dates';
import { formatMoney } from '@finnit/core/finance/money';
import { groupByDay } from '@finnit/core/finance/transactions';
import type { ApiCategory, ApiTransaction, Connection } from '@finnit/core/finance/types';
import { requestErrorMessage } from '@finnit/core/graphql/request';
import {
  HISTORY_PAGE_SIZE,
  hasFilters,
  monthLinks,
  toApiFilters,
  withPeriod,
  type HistoryFilters,
} from '@finnit/core/history/filters';
import { TRANSACTIONS_PAGE_QUERY, dayNet, toTransactionPage, type TransactionPage } from '@finnit/core/history/view';
import { cn } from '@finnit/ui-native/lib/utils';
import { TwView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { EmptyState } from '@finnit/ui-native/components/ui/empty-state';
import { Text } from '@finnit/ui-native/components/ui/text';
import { LabelSm } from '@finnit/ui-native/components/ui/typography';

import { TransactionListCard } from '@/components/finance/transaction-card';
import { useGql } from '@/lib/graphql/runner';
import { useLocalizer } from '@/lib/i18n/i18n-provider';

/** Movements grouped by day, with "Cargar más" (the web's HistoryList). */
export function HistoryList({
  initial,
  filters,
  categories,
  today,
  onFiltersChange,
}: {
  initial: TransactionPage;
  filters: HistoryFilters;
  categories: ApiCategory[];
  today: DayKey;
  onFiltersChange: (next: HistoryFilters) => void;
}) {
  const t = useTranslations();
  const l = useLocalizer();
  const gql = useGql();
  const router = useRouter();
  const [page, setPage] = React.useState(initial);
  const [seed, setSeed] = React.useState(initial);
  if (seed !== initial) {
    setSeed(initial);
    setPage(initial);
  }
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const index = React.useMemo(() => indexCategories(categories), [categories]);
  const groups = React.useMemo(() => groupByDay(page.rows, today, l.locale), [page.rows, today, l.locale]);
  const links = monthLinks(filters, today);
  const previous = links
    ? {
        label: t('history.previousMonth', { month: monthName(links.prev, l.locale) }),
        onPress: () => onFiltersChange(withPeriod(filters, links.prev)),
      }
    : null;

  async function loadMore() {
    if (!page.hasNextPage || loading) return;
    setLoading(true);
    setError(null);
    try {
      const { transactions } = await gql<{ transactions: Connection<ApiTransaction> }>(TRANSACTIONS_PAGE_QUERY, {
        first: HISTORY_PAGE_SIZE,
        after: page.endCursor,
        filters: toApiFilters(filters),
      });
      const next = toTransactionPage(transactions, index, l);
      setPage((current) => {
        const seen = new Set(current.rows.map((r) => r.id));
        return { ...next, rows: [...current.rows, ...next.rows.filter((r) => !seen.has(r.id))] };
      });
    } catch (e) {
      setError(requestErrorMessage(e, l.t));
    } finally {
      setLoading(false);
    }
  }

  if (page.rows.length === 0) {
    if (filters.search && filters.period !== 'all') {
      return (
        <EmptyState
          icon={SearchX}
          title={t('history.noResultsTitle')}
          description={t('history.searchOtherMonths')}
          action={{ label: t('history.searchAllTime'), onPress: () => onFiltersChange(withPeriod(filters, 'all')) }}
        />
      );
    }
    if (hasFilters(filters)) {
      return (
        <EmptyState icon={SearchX} title={t('history.noResultsTitle')} description={t('history.noResultsDescription')} />
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
        action={{ label: t('common.connectBank'), onPress: () => router.push('/connect-bank') }}
      />
    );
  }

  return (
    <TwView>
      <Text accessibilityLiveRegion="polite" className="mb-4 px-1 text-xs text-on-surface-variant">
        {t('history.count', { shown: String(page.rows.length), total: page.totalCount })}
      </Text>
      {groups.map((group) => {
        const net = dayNet(group.rows);
        return (
          <TwView key={group.day} className="mb-8">
            <TwView className="mb-3 flex-row items-baseline justify-between gap-3 px-1">
              <LabelSm accessibilityRole="header">{group.heading}</LabelSm>
              {net && net.amount !== 0 ? (
                <Text
                  weight="bold"
                  className={cn('text-xs', net.amount > 0 ? 'text-income' : 'text-on-surface-variant')}
                  style={{ fontVariant: ['tabular-nums'] }}
                >
                  {formatMoney(net.amount, net.currency, l.locale, { sign: 'always' })}
                </Text>
              ) : null}
            </TwView>
            <TwView className="gap-2">
              {group.rows.map((row) => (
                <TransactionListCard key={row.id} row={row} showStatus />
              ))}
            </TwView>
          </TwView>
        );
      })}
      {error ? (
        <Text accessibilityRole="alert" className="mb-3 text-sm text-expense">
          {error}
        </Text>
      ) : null}
      {page.hasNextPage ? (
        <Button
          variant="outline"
          className="w-full"
          label={loading ? t('common.loading') : t('common.loadMore')}
          onPress={loadMore}
          disabled={loading}
        />
      ) : previous ? (
        <Button variant="outline" className="w-full" label={previous.label} onPress={previous.onPress} />
      ) : null}
    </TwView>
  );
}
