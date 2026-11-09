import * as React from 'react';
import { useTranslations } from 'use-intl';
import { Check, CircleCheck, Sparkles, X } from 'lucide-react-native';

import {
  categorize,
  categorizeErrorMessage,
  fetchPage,
  renameTransaction,
  reviewSuggestions,
  suggestCategories,
  toPageData,
} from '@finnit/core/categorize/api';
import { SHOW_OPTIONS, parseCategorizeFilters, type CategorizeFilters } from '@finnit/core/categorize/filters';
import { CATEGORIZE_QUERY, type CategorizeResult } from '@finnit/core/categorize/request';
import {
  SUGGEST_MAX,
  isAllSelected,
  pruneSelection,
  reviewTargets,
  selectedIds,
  suggestionOutcome,
  suggestionTargets,
  toggleAll,
  toggleSelection,
} from '@finnit/core/categorize/selection';
import { pageVariables } from '@finnit/core/categorize/filters';
import type { CategorizePageData, CategorizeTransaction } from '@finnit/core/categorize/types';
import { appendPage, mergeTransactions, toCategorizeRow } from '@finnit/core/categorize/view';
import { indexCategories } from '@finnit/core/finance/categories';
import { todayKey } from '@finnit/core/finance/dates';
import { groupByDay } from '@finnit/core/finance/transactions';
import { categoryOptions } from '@finnit/core/new-entry/options';
import { TwView } from '@finnit/ui-native/lib/tw';
import { FilterChipGroup } from '@finnit/ui-native/components/finance/filter-chip-group';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Checkbox } from '@finnit/ui-native/components/ui/checkbox';
import { EmptyState } from '@finnit/ui-native/components/ui/empty-state';
import { Text } from '@finnit/ui-native/components/ui/text';
import { toast } from '@finnit/ui-native/components/ui/toaster';
import { LabelSm } from '@finnit/ui-native/components/ui/typography';

import { MoveBar } from '@/components/categorize/move-sheet';
import { TransactionListCard } from '@/components/finance/transaction-card';
import { Screen } from '@/components/shell/screen';
import { useGql } from '@/lib/graphql/runner';
import { useView } from '@/lib/graphql/use-view';
import { useLocalizer } from '@/lib/i18n/i18n-provider';
import { useOnTransactionsChanged } from '@/lib/transactions/events';
import { DuplicateSuggestionsPanel } from '@/components/duplicates/duplicate-suggestions-panel';

type Busy = 'move' | 'suggest' | 'review' | null;

/** Clasificar: pick movements, move them to a category, ask the AI and review its suggestions. */
export function CategorizeScreen() {
  const l = useLocalizer();
  const { t, locale } = l;
  const tc = useTranslations('categorize');
  const gql = useGql();
  const today = todayKey();
  const [filters, setFilters] = React.useState<CategorizeFilters>(() => parseCategorizeFilters({}, today));
  const { view, loading, error, refreshing, refresh } = useView({
    query: CATEGORIZE_QUERY,
    variables: pageVariables(filters),
    build: (data: CategorizeResult) => ({ page: toPageData(data.transactions), categories: data.categories }),
  });
  const [page, setPage] = React.useState<CategorizePageData | null>(null);
  React.useEffect(() => {
    if (view) setPage(view.page);
  }, [view]);
  const [selection, setSelection] = React.useState<ReadonlySet<string>>(() => new Set());
  const [busy, setBusy] = React.useState<Busy>(null);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const categories = React.useMemo(() => view?.categories ?? [], [view]);
  const index = React.useMemo(() => indexCategories(categories), [categories]);
  const rows = React.useMemo(() => (page?.transactions ?? []).map((tx) => toCategorizeRow(tx, index, l)), [page, index, l]);
  const groups = React.useMemo(() => groupByDay(rows, today, locale), [rows, today, locale]);
  const options = React.useMemo(
    () => categoryOptions(categories, 'any', locale).map((o) => ({ value: o.value, label: o.label, hint: o.group && o.group !== o.label ? o.group : undefined })),
    [categories, locale],
  );
  const selected = React.useMemo(() => pruneSelection(selection, rows), [selection, rows]);
  const review = reviewTargets(rows, selected);

  const reload = React.useCallback(async () => {
    if (!page) return refresh();
    try {
      setPage(await fetchPage(filters, { loaded: page.transactions.length }, gql));
    } catch (e) {
      toast.error(categorizeErrorMessage(e, t));
    }
  }, [page, filters, gql, t, refresh]);
  useOnTransactionsChanged(() => void reload());

  const merge = (updates: ReadonlyArray<CategorizeTransaction>) =>
    setPage((current) => (current ? { ...current, transactions: mergeTransactions(current.transactions, updates) } : current));

  async function run(kind: Exclude<Busy, null>, action: () => Promise<void>) {
    if (busy) return;
    setBusy(kind);
    try {
      await action();
    } catch (e) {
      toast.error(categorizeErrorMessage(e, t));
    } finally {
      setBusy(null);
    }
  }

  const move = (categoryId: string, remember: boolean) =>
    run('move', async () => {
      const changed = await categorize(selectedIds(rows, selected), categoryId, remember, gql);
      toast.success(t('categorize.toasts.categorized', { count: changed }));
      setSelection(new Set());
      await reload();
    });

  const suggest = () =>
    run('suggest', async () => {
      const { ids, truncated } = suggestionTargets(rows, selected);
      if (truncated) toast.info(t('categorize.tooMany', { max: SUGGEST_MAX }));
      const returned = await suggestCategories(ids, gql);
      merge(returned);
      const outcome = suggestionOutcome(ids, returned);
      if (outcome.unavailable) toast.info(t('categorize.aiUnavailable'));
      else toast.success(t('categorize.toasts.suggested', { count: outcome.suggested }));
    });

  const reviewMany = (action: 'accept' | 'reject', ids: string[]) =>
    run('review', async () => {
      const count = await reviewSuggestions(action, ids, gql);
      toast.success(t(action === 'accept' ? 'categorize.toasts.accepted' : 'categorize.toasts.rejected', { count }));
      await reload();
    });

  async function loadMore() {
    if (!page?.hasNextPage || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await fetchPage(filters, { after: page.endCursor }, gql);
      setPage((current) => (current ? { ...next, transactions: appendPage(current.transactions, next.transactions) } : next));
    } catch (e) {
      toast.error(categorizeErrorMessage(e, t));
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <Screen title={tc('title')} subtitle={tc('subtitle')} loading={loading && !page} error={!page ? error : undefined} refreshing={refreshing} onRefresh={refresh}>
      <TwView className="gap-4">
        <DuplicateSuggestionsPanel />
        <FilterChipGroup
          accessibilityLabel={tc('filters.show')}
          items={SHOW_OPTIONS.map((value) => ({ value, label: tc(`filters.shows.${value}`) }))}
          activeValue={filters.show}
          onSelect={(show) => {
            setSelection(new Set());
            setFilters((f) => ({ ...f, show }));
          }}
        />
        {page && rows.length === 0 ? (
          <EmptyState icon={CircleCheck} title={tc(`empty.${filters.show}Title`)} description={tc(`empty.${filters.show}Description`)} />
        ) : page ? (
          <>
            <TwView className="flex-row flex-wrap items-center gap-2">
              <Checkbox checked={isAllSelected(rows, selected)} onCheckedChange={() => setSelection(toggleAll(rows, selected))} label={tc('selectAll')} />
              <Text accessibilityLiveRegion="polite" className="flex-1 px-1 text-xs text-on-surface-variant">
                {tc('count', { shown: String(rows.length), total: page.totalCount })}
              </Text>
              <Button
                variant="secondary"
                size="sm"
                icon={Sparkles}
                disabled={busy !== null || suggestionTargets(rows, selected).ids.length === 0}
                label={busy === 'suggest' ? tc('suggesting') : tc('suggest')}
                onPress={suggest}
              />
            </TwView>
            {review.length > 0 ? (
              <TwView className="flex-row flex-wrap gap-2">
                <Button variant="outline" size="sm" disabled={busy !== null} label={tc('acceptAll', { count: review.length })} onPress={() => reviewMany('accept', review)} />
                <Button variant="outline" size="sm" disabled={busy !== null} label={tc('rejectAll', { count: review.length })} onPress={() => reviewMany('reject', review)} />
              </TwView>
            ) : null}
            {groups.map((group) => (
              <TwView key={group.day} className="gap-2">
                <LabelSm accessibilityRole="header" className="px-1">
                  {group.heading}
                </LabelSm>
                {group.rows.map((row) => {
                  const source = row.categoryId && row.categorySource && row.categorySource !== 'manual' ? ` (${tc(`sources.${row.categorySource}`)})` : '';
                  return (
                    <TransactionListCard
                      key={row.id}
                      row={row}
                      category={row.selectable ? `${row.category}${source}` : tc('notCategorizable')}
                      selectable={row.selectable}
                      selected={selected.has(row.id)}
                      onSelectedChange={(checked) => setSelection(toggleSelection(selected, row.id, checked))}
                      selectLabel={tc('selectRow', { name: row.title })}
                      rename={async (name) => {
                        const updated = await renameTransaction(row.id, { displayName: name, isPrivate: row.name.ownPrivate }, gql);
                        merge([updated]);
                      }}
                      footer={
                        row.suggestion ? (
                          <TwView className="flex-row items-center gap-2 rounded-full bg-primary-15 px-3 py-1">
                            <Text weight="medium" numberOfLines={1} className="flex-1 text-xs">
                              {tc('suggestion', { category: row.suggestion.label })}
                            </Text>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              icon={Check}
                              disabled={busy !== null}
                              label={tc('acceptSuggestion', { category: row.suggestion.label })}
                              onPress={() => reviewMany('accept', [row.id])}
                            />
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              icon={X}
                              disabled={busy !== null}
                              label={tc('rejectSuggestion', { category: row.suggestion.label })}
                              onPress={() => reviewMany('reject', [row.id])}
                            />
                          </TwView>
                        ) : undefined
                      }
                    />
                  );
                })}
              </TwView>
            ))}
            {page.hasNextPage ? (
              <Button variant="outline" className="w-full" label={loadingMore ? t('common.loading') : t('common.loadMore')} disabled={loadingMore} onPress={loadMore} />
            ) : null}
            {selected.size > 0 ? (
              <MoveBar count={selected.size} categories={options} busy={busy === 'move'} onMove={move} onClear={() => setSelection(new Set())} />
            ) : null}
          </>
        ) : null}
      </TwView>
    </Screen>
  );
}
