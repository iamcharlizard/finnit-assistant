import * as React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslations } from 'use-intl';

import { todayKey } from '@finnit/core/finance/dates';
import { parseHistoryFilters, type HistoryFilters as Filters } from '@finnit/core/history/filters';
import { HISTORY_QUERY, buildHistoryData, historyVariables, type HistoryResult } from '@finnit/core/history/request';
import { TwView } from '@finnit/ui-native/lib/tw';

import { HistoryFilters } from '@/components/history/history-filters';
import { HistoryList } from '@/components/history/history-list';
import { TopCategoriesCard } from '@/components/history/top-categories-card';
import { Screen } from '@/components/shell/screen';
import { useView } from '@/lib/graphql/use-view';
import { historyParams } from '@/lib/history/params';
import { useOnTransactionsChanged } from '@/lib/transactions/events';

/** Movimientos: the filtered history by day, like the web's /history. */
export function HistoryScreen() {
  const t = useTranslations('history');
  const router = useRouter();
  const params = useLocalSearchParams<Record<string, string>>();
  const today = todayKey();
  const filters = React.useMemo(() => parseHistoryFilters(params, today), [params, today]);

  const { view, loading, error, refreshing, refresh } = useView({
    query: HISTORY_QUERY,
    variables: historyVariables(filters),
    build: (data: HistoryResult, l) => buildHistoryData(data, filters, today, l),
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
          <HistoryFilters
            filters={filters}
            accounts={view.accounts}
            categories={view.categoryOptions}
            today={today}
            aliasName={view.aliasName}
            onChange={apply}
          />
          <HistoryList
            initial={view.page}
            filters={filters}
            categories={view.categories}
            today={today}
            onFiltersChange={apply}
          />
          {view.topCategories.rows.length > 0 ? (
            <TopCategoriesCard data={view.topCategories} />
          ) : null}
        </TwView>
      ) : null}
    </Screen>
  );
}
