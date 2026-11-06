import * as React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from 'urql';
import { useTranslations } from 'use-intl';
import { Repeat, SearchCheck, SearchX } from 'lucide-react-native';

import { todayKey } from '@finnit/core/finance/dates';
import { requestErrorMessage } from '@finnit/core/graphql/request';
import { SUGGESTIONS_QUERY, dismissSuggestion, saveRecurring, setRecurringActive } from '@finnit/core/recurring/api';
import {
  accountOptions,
  applyExpenseFilters,
  kindOptions,
  parseExpenseFilters,
  type ExpenseFilters,
} from '@finnit/core/recurring/filters';
import { formOfSuggestion } from '@finnit/core/recurring/form';
import { RECURRING_QUERY, recurringData, recurringVariables, type RecurringResult } from '@finnit/core/recurring/request';
import { toSuggestionCard } from '@finnit/core/recurring/suggestions';
import { parseTabParam, RECURRING_TABS, type RecurringTab } from '@finnit/core/recurring/tabs';
import type { ApiRecurringSuggestion } from '@finnit/core/recurring/types';
import { buildRecurringView, type ExpenseItem } from '@finnit/core/recurring/view';
import { TwView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { EmptyState } from '@finnit/ui-native/components/ui/empty-state';
import { Segmented } from '@finnit/ui-native/components/ui/segmented';
import { Text } from '@finnit/ui-native/components/ui/text';
import { toast } from '@finnit/ui-native/components/ui/toaster';

import { ExpenseCard } from '@/components/recurring/expense-card';
import { ExpenseFiltersBar } from '@/components/recurring/expense-filters';
import { SuggestionCard } from '@/components/recurring/suggestion-card';
import { Screen } from '@/components/shell/screen';
import { useGql } from '@/lib/graphql/runner';
import { useView } from '@/lib/graphql/use-view';
import { useLocalizer } from '@/lib/i18n/i18n-provider';
import { useOnTransactionsChanged } from '@/lib/transactions/events';

/**
 * Pagos recurrentes: the user's recurring expenses behind a filter bar,
 * and the ones detected in their movements. Their dates and totals are in
 * the calendar screen.
 */
export function RecurringScreen() {
  const t = useTranslations();
  const l = useLocalizer();
  const gql = useGql();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string; q?: string; status?: string; kind?: string; account?: string; sort?: string }>();
  const today = todayKey();
  const tab = parseTabParam(params.tab);
  const [filters, setFilters] = React.useState<ExpenseFilters>(() => parseExpenseFilters(params));
  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  // Suggestions taken off the list (added or dismissed) until the next load.
  const [gone, setGone] = React.useState<ReadonlySet<string>>(new Set());

  const { view, loading, error, refreshing, refresh } = useView({
    query: RECURRING_QUERY,
    variables: recurringVariables('month', today),
    build: (data: RecurringResult, loc) => buildRecurringView(recurringData(data), { view: 'month', date: today, today }, loc),
  });
  // The first detection may call AI: only when the tab is open.
  const [suggestions, reloadSuggestions] = useQuery<{ recurringSuggestions: ApiRecurringSuggestion[] }>({
    query: SUGGESTIONS_QUERY,
    pause: tab !== 'suggestions',
  });
  useOnTransactionsChanged(refresh);

  const expenses = view?.expenses ?? [];
  const kinds = kindOptions(expenses, (kind) => t(`finance.recurringKinds.${kind}`));
  const accounts = accountOptions(expenses, t('calendar.summary.noAccount'), l.locale);
  const shown = applyExpenseFilters(expenses, filters, l.locale);
  const pending = (suggestions.data?.recurringSuggestions ?? []).filter((s) => !gone.has(s.fingerprint));

  async function toggleActive(item: ExpenseItem) {
    setBusyKey(item.id);
    try {
      await setRecurringActive(item.id, !item.active, gql);
      toast.success(t(item.active ? 'recurring.toasts.paused' : 'recurring.toasts.resumed', { name: item.name }));
      refresh();
    } catch (e) {
      toast.error(requestErrorMessage(e, l.t));
    } finally {
      setBusyKey(null);
    }
  }

  async function addSuggestion(suggestion: ApiRecurringSuggestion) {
    setBusyKey(suggestion.fingerprint);
    try {
      const form = formOfSuggestion(suggestion);
      await saveRecurring(form, { mode: 'suggestion', fingerprint: suggestion.fingerprint, initial: form }, gql);
      setGone((current) => new Set(current).add(suggestion.fingerprint));
      toast.success(t('recurring.toasts.accepted', { name: suggestion.suggestedName }));
      refresh();
    } catch (e) {
      toast.error(requestErrorMessage(e, l.t));
    } finally {
      setBusyKey(null);
    }
  }

  async function dismiss(suggestion: ApiRecurringSuggestion) {
    setGone((current) => new Set(current).add(suggestion.fingerprint));
    try {
      await dismissSuggestion(suggestion.fingerprint, gql);
      toast.success(t('recurring.toasts.dismissed', { name: suggestion.suggestedName }));
    } catch (e) {
      setGone((current) => {
        const next = new Set(current);
        next.delete(suggestion.fingerprint);
        return next;
      });
      toast.error(requestErrorMessage(e, l.t));
    }
  }

  const reload = () => {
    refresh();
    if (tab === 'suggestions') {
      setGone(new Set());
      reloadSuggestions({ requestPolicy: 'network-only' });
    }
  };

  return (
    <Screen
      title={t('pageTitles.recurring')}
      subtitle={t('recurring.subtitle')}
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={reload}
    >
      {view ? (
        <TwView className="gap-5">
          <Segmented
            accessibilityLabel={t('recurring.tabs.label')}
            options={RECURRING_TABS.map((value) => ({ value, label: t(`recurring.tabs.${value}`) }))}
            value={tab}
            onValueChange={(next: RecurringTab) => router.setParams({ tab: next === 'list' ? undefined : next })}
          />

          {tab === 'list' ? (
            expenses.length === 0 ? (
              <EmptyState icon={Repeat} title={t('recurring.list.emptyTitle')} description={t('recurring.list.emptyDescription')} />
            ) : (
              <TwView className="gap-4">
                <ExpenseFiltersBar filters={filters} onChange={setFilters} kinds={kinds} accounts={accounts} count={shown.length} />
                {shown.length === 0 ? (
                  <EmptyState icon={SearchX} title={t('recurring.list.emptyFiltered')} />
                ) : (
                  <TwView className="gap-3">
                    {shown.map((item) => (
                      <ExpenseCard key={item.id} item={item} busy={busyKey === item.id} onToggleActive={() => toggleActive(item)} />
                    ))}
                  </TwView>
                )}
              </TwView>
            )
          ) : suggestions.fetching && !suggestions.data ? (
            <Text className="py-6 text-center text-on-surface-variant">{t('recurring.suggestions.loading')}</Text>
          ) : suggestions.error ? (
            <TwView className="items-center gap-3 py-6">
              <Text className="text-center text-on-surface-variant">{t('recurring.suggestions.loadError')}</Text>
              <Button variant="outline" label={t('recurring.suggestions.retry')} onPress={() => reloadSuggestions({ requestPolicy: 'network-only' })} />
            </TwView>
          ) : pending.length === 0 ? (
            <EmptyState icon={SearchCheck} title={t('recurring.suggestions.empty')} />
          ) : (
            <TwView className="gap-3">
              <Text className="px-1 text-sm text-on-surface-variant">{t('recurring.suggestions.subtitle')}</Text>
              {pending.map((suggestion) => (
                <SuggestionCard
                  key={suggestion.fingerprint}
                  card={toSuggestionCard(suggestion, today, l)}
                  busy={busyKey === suggestion.fingerprint}
                  onAdd={() => void addSuggestion(suggestion)}
                  onDismiss={() => void dismiss(suggestion)}
                />
              ))}
            </TwView>
          )}
        </TwView>
      ) : null}
    </Screen>
  );
}
