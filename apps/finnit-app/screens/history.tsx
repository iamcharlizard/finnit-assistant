import * as React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslations } from 'use-intl';
import { PartyPopper } from 'lucide-react-native';

import { todayKey } from '@finnit/core/finance/dates';
import {
  parseHistoryFilters,
  toApiFilters,
  withPeriod,
  type HistoryFilters as Filters,
} from '@finnit/core/history/filters';
import {
  HISTORY_QUERY,
  buildHistoryData,
  historyVariables,
  type HistoryResult,
} from '@finnit/core/history/request';
import { TwView } from '@finnit/ui-native/lib/tw';
import { EmptyState } from '@finnit/ui-native/components/ui/empty-state';

import { ReviewList } from '@/components/categorize/review-list';
import { DuplicateSuggestionsPanel } from '@/components/duplicates/duplicate-suggestions-panel';
import { AccountBalanceCard } from '@/components/history/account-balance-card';
import { HistoryFilters } from '@/components/history/history-filters';
import { HistoryList } from '@/components/history/history-list';
import { TopCategoriesCard } from '@/components/history/top-categories-card';
import { Screen } from '@/components/shell/screen';
import { TransferSuggestionsPanel } from '@/components/transfers/transfer-suggestions-panel';
import { useView } from '@/lib/graphql/use-view';
import { historyParams } from '@/lib/history/params';
import { useOnTransactionsChanged } from '@/lib/transactions/events';

/**
 * Movimientos: the filtered history by day, like the web's /history, and
 * "Por clasificar" (the movements without a category, to categorize them).
 * Possible duplicates and transfers to review sit on top.
 */
export function HistoryScreen() {
  const t = useTranslations('history');
  const tc = useTranslations('categorize');
  const router = useRouter();
  const params = useLocalSearchParams<Record<string, string>>();
  const today = todayKey();
  const filters = React.useMemo(
    () => parseHistoryFilters(params, today),
    [params, today],
  );
  const reviewFilters = React.useMemo(() => toApiFilters(filters), [filters]);

  const { view, loading, error, refreshing, refresh } = useView({
    query: HISTORY_QUERY,
    variables: historyVariables(filters),
    build: (data: HistoryResult, l) =>
      buildHistoryData(data, filters, today, l),
  });
  useOnTransactionsChanged(refresh);

  const apply = React.useCallback(
    (next: Filters) => router.setParams(historyParams(next, today)),
    [router, today],
  );

  return (
    <Screen
      title={t('title')}
      subtitle={t('subtitle')}
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      {view ? (
        <TwView className="gap-6">
          <DuplicateSuggestionsPanel />
          <TransferSuggestionsPanel
            suggestions={view.transferSuggestions.rows}
            total={view.transferSuggestions.total}
          />
          <HistoryFilters
            filters={filters}
            accounts={view.accounts}
            categories={view.categoryOptions}
            today={today}
            aliasName={view.aliasName}
            reviewCount={view.reviewCount}
            onChange={apply}
          />
          {view.account ? <AccountBalanceCard card={view.account} /> : null}
          {view.reviewPage ? (
            <ReviewList
              initial={view.reviewPage}
              filters={reviewFilters}
              categories={view.pickable}
              today={today}
              onChange={refresh}
              empty={
                <EmptyState
                  icon={PartyPopper}
                  title={tc('empty.uncategorizedTitle')}
                  description={tc('empty.uncategorizedDescription')}
                  action={
                    filters.period !== 'all' && !filters.from && !filters.to
                      ? {
                          label: tc('empty.seeAllTime'),
                          onPress: () => apply(withPeriod(filters, 'all')),
                        }
                      : undefined
                  }
                />
              }
            />
          ) : (
            <HistoryList
              initial={view.page}
              filters={filters}
              categories={view.categories}
              today={today}
              onFiltersChange={apply}
            />
          )}
          {view.topCategories.rows.length > 0 ? (
            <TopCategoriesCard data={view.topCategories} />
          ) : null}
        </TwView>
      ) : null}
    </Screen>
  );
}
