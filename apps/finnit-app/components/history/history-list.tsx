import * as React from 'react';
import { useRouter } from 'expo-router';
import { useTranslations } from 'use-intl';
import { CalendarSearch, Inbox, SearchX } from 'lucide-react-native';

import { indexCategories } from '@finnit/core/finance/categories';
import { monthName, type DayKey } from '@finnit/core/finance/dates';
import { formatMoney } from '@finnit/core/finance/money';
import { groupByDay } from '@finnit/core/finance/transactions';
import type {
  ApiCategory,
  ApiTransaction,
  Connection,
} from '@finnit/core/finance/types';
import { requestErrorMessage } from '@finnit/core/graphql/request';
import {
  HISTORY_MAX_SHOWN,
  HISTORY_PAGE_SIZE,
  hasFilters,
  monthLinks,
  toApiFilters,
  withPeriod,
  type HistoryFilters,
} from '@finnit/core/history/filters';
import {
  TRANSACTIONS_PAGE_QUERY,
  dayNet,
  groupTransfers,
  toTransactionPage,
  type TransactionPage,
} from '@finnit/core/history/view';
import { cn } from '@finnit/ui-native/lib/utils';
import { TwView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { EmptyState } from '@finnit/ui-native/components/ui/empty-state';
import { Text } from '@finnit/ui-native/components/ui/text';
import { LabelSm } from '@finnit/ui-native/components/ui/typography';

import { useGql } from '@/lib/graphql/runner';
import { useLocalizer } from '@/lib/i18n/i18n-provider';
import { useOnScrollEnd } from '@/components/shell/screen';
import { HistoryRow } from './history-row';
import { TransferGroupCard } from './transfer-group-card';

/** Movements grouped by day (a transfer's two sides as one item), with "Cargar más" (the web's HistoryList). */
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
  // How many rows were loaded: a refresh (after an edit) brings them all
  // back, not only the first page.
  const loaded = React.useRef(initial.rows.length);
  React.useEffect(() => {
    loaded.current = page.rows.length;
  }, [page.rows.length]);
  React.useEffect(() => {
    const wanted = Math.min(HISTORY_MAX_SHOWN, loaded.current);
    if (wanted <= initial.rows.length || !initial.hasNextPage) return;
    let live = true;
    gql<{ transactions: Connection<ApiTransaction> }>(TRANSACTIONS_PAGE_QUERY, {
      first: wanted,
      after: null,
      filters: toApiFilters(filters),
    })
      .then(
        ({ transactions }) =>
          live && setPage(toTransactionPage(transactions, index, l)),
      )
      .catch(() => undefined);
    return () => {
      live = false;
    };
    // Only when a refresh brings a new first page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);
  const groups = React.useMemo(
    () =>
      groupByDay(page.rows, today, l.locale).map((group) => ({
        ...group,
        items: groupTransfers(group.rows, l),
      })),
    [page.rows, today, l],
  );
  const links = monthLinks(filters, today);
  const previous = links
    ? {
        label: t('history.previousMonth', {
          month: monthName(links.prev, l.locale),
        }),
        onPress: () => onFiltersChange(withPeriod(filters, links.prev)),
      }
    : null;

  // Infinite scroll: the next page loads as the end comes near.
  useOnScrollEnd(() => {
    if (!error) void loadMore();
  });

  async function loadMore() {
    if (!page.hasNextPage || loading) return;
    setLoading(true);
    setError(null);
    try {
      const { transactions } = await gql<{
        transactions: Connection<ApiTransaction>;
      }>(TRANSACTIONS_PAGE_QUERY, {
        first: HISTORY_PAGE_SIZE,
        after: page.endCursor,
        filters: toApiFilters(filters),
      });
      const next = toTransactionPage(transactions, index, l);
      setPage((current) => {
        const seen = new Set(current.rows.map((r) => r.id));
        return {
          ...next,
          rows: [...current.rows, ...next.rows.filter((r) => !seen.has(r.id))],
        };
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
          action={{
            label: t('history.searchAllTime'),
            onPress: () => onFiltersChange(withPeriod(filters, 'all')),
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
          label: t('common.connectBank'),
          onPress: () => router.push('/connect-bank'),
        }}
      />
    );
  }

  return (
    <TwView>
      <Text
        accessibilityLiveRegion="polite"
        className="mb-4 px-1 text-xs text-on-surface-variant"
      >
        {t('history.count', {
          shown: String(page.rows.length),
          total: page.totalCount,
        })}
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
                  className={cn(
                    'text-xs',
                    net.amount > 0 ? 'text-income' : 'text-on-surface-variant',
                  )}
                  style={{ fontVariant: ['tabular-nums'] }}
                >
                  {formatMoney(net.amount, net.currency, l.locale, {
                    sign: 'always',
                  })}
                </Text>
              ) : null}
            </TwView>
            <TwView className="gap-2">
              {group.items.map((item) =>
                item.kind === 'transfer' ? (
                  <TransferGroupCard key={item.key} group={item} />
                ) : (
                  <HistoryRow key={item.row.id} row={item.row} />
                ),
              )}
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
        loading ? (
          <Text
            accessibilityLiveRegion="polite"
            className="py-3 text-center text-xs text-on-surface-variant"
          >
            {t('common.loading')}
          </Text>
        ) : (
          <Button
            variant="ghost"
            className="w-full"
            label={t('common.loadMore')}
            onPress={loadMore}
          />
        )
      ) : previous ? (
        <Button
          variant="outline"
          className="w-full"
          label={previous.label}
          onPress={previous.onPress}
        />
      ) : null}
    </TwView>
  );
}
