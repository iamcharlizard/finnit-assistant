import * as React from 'react';
import { useTranslations } from 'use-intl';
import { Sparkles } from 'lucide-react-native';

import {
  categorize,
  categorizeErrorMessage,
  fetchPage,
  renameTransaction,
  reviewSuggestions,
  suggestCategories,
} from '@finnit/core/categorize/api';
import type { ApiTransactionFilters } from '@finnit/core/categorize/filters';
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
import type {
  CategorizePageData,
  CategorizeTransaction,
} from '@finnit/core/categorize/types';
import {
  appendPage,
  mergeTransactions,
  toCategorizeRow,
} from '@finnit/core/categorize/view';
import { indexCategories } from '@finnit/core/finance/categories';
import type { DayKey } from '@finnit/core/finance/dates';
import { groupByDay } from '@finnit/core/finance/transactions';
import type { EntryCategory } from '@finnit/core/new-entry/graphql';
import { categoryOptions } from '@finnit/core/new-entry/options';
import { TwView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Checkbox } from '@finnit/ui-native/components/ui/checkbox';
import { Text } from '@finnit/ui-native/components/ui/text';
import { toast } from '@finnit/ui-native/components/ui/toaster';
import { LabelSm } from '@finnit/ui-native/components/ui/typography';

import { MoveBar } from '@/components/categorize/move-sheet';
import { SuggestionPill } from '@/components/categorize/suggestion-pill';
import { TransactionListCard } from '@/components/finance/transaction-card';
import { useOnScrollEnd } from '@/components/shell/screen';
import { useGql } from '@/lib/graphql/runner';
import { useLocalizer } from '@/lib/i18n/i18n-provider';

type Busy = 'move' | 'suggest' | 'review' | null;

/**
 * "Por clasificar" in the history: the movements without a category, to
 * pick and move to a category, ask the AI and review its suggestions. Mount
 * it again (React key) when the filters change.
 */
export function ReviewList({
  initial,
  filters,
  categories,
  today,
  empty,
  onChange,
}: {
  initial: CategorizePageData;
  filters: ApiTransactionFilters;
  categories: EntryCategory[];
  today: DayKey;
  empty: React.ReactNode;
  /** Something was categorized (counts and charts change). */
  onChange: () => void;
}) {
  const l = useLocalizer();
  const { t, locale } = l;
  const tc = useTranslations('categorize');
  const gql = useGql();
  const [page, setPage] = React.useState<CategorizePageData>(initial);
  // A refresh of the screen brings a new first page.
  const [seed, setSeed] = React.useState(initial);
  if (seed !== initial) {
    setSeed(initial);
    setPage(initial);
  }
  const [selection, setSelection] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [busy, setBusy] = React.useState<Busy>(null);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const index = React.useMemo(() => indexCategories(categories), [categories]);
  const rows = React.useMemo(
    () => page.transactions.map((tx) => toCategorizeRow(tx, index, l)),
    [page, index, l],
  );
  const groups = React.useMemo(
    () => groupByDay(rows, today, locale),
    [rows, today, locale],
  );
  const options = React.useMemo(
    () =>
      categoryOptions(categories, 'any', locale).map((o) => ({
        value: o.value,
        label: o.label,
        hint: o.group && o.group !== o.label ? o.group : undefined,
      })),
    [categories, locale],
  );
  const selected = React.useMemo(
    () => pruneSelection(selection, rows),
    [selection, rows],
  );
  const review = reviewTargets(rows, selected);

  const reload = async () => {
    setPage(
      await fetchPage(filters, { loaded: page.transactions.length }, gql),
    );
    onChange();
  };

  const merge = (updates: readonly CategorizeTransaction[]) =>
    setPage((current) => ({
      ...current,
      transactions: mergeTransactions(current.transactions, updates),
    }));

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
      const changed = await categorize(
        selectedIds(rows, selected),
        categoryId,
        remember,
        gql,
      );
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
      else
        toast.success(
          t('categorize.toasts.suggested', { count: outcome.suggested }),
        );
    });

  const reviewMany = (action: 'accept' | 'reject', ids: string[]) =>
    run('review', async () => {
      const count = await reviewSuggestions(action, ids, gql);
      toast.success(
        t(
          action === 'accept'
            ? 'categorize.toasts.accepted'
            : 'categorize.toasts.rejected',
          { count },
        ),
      );
      await reload();
    });

  // Infinite scroll, like the history.
  useOnScrollEnd(() => void loadMore());

  async function loadMore() {
    if (!page.hasNextPage || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await fetchPage(filters, { after: page.endCursor }, gql);
      setPage((current) => ({
        ...next,
        transactions: appendPage(current.transactions, next.transactions),
      }));
    } catch (e) {
      toast.error(categorizeErrorMessage(e, t));
    } finally {
      setLoadingMore(false);
    }
  }

  if (rows.length === 0) return <>{empty}</>;

  return (
    <TwView className="gap-4">
      <TwView className="flex-row flex-wrap items-center gap-2">
        <Checkbox
          checked={isAllSelected(rows, selected)}
          onCheckedChange={() => setSelection(toggleAll(rows, selected))}
          label={tc('selectAll')}
        />
        <Text
          accessibilityLiveRegion="polite"
          className="flex-1 px-1 text-xs text-on-surface-variant"
        >
          {tc('count', { shown: String(rows.length), total: page.totalCount })}
        </Text>
        <Button
          variant="secondary"
          size="sm"
          icon={Sparkles}
          disabled={
            busy !== null || suggestionTargets(rows, selected).ids.length === 0
          }
          label={busy === 'suggest' ? tc('suggesting') : tc('suggest')}
          onPress={suggest}
        />
      </TwView>
      {review.length > 0 ? (
        <TwView className="flex-row flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={busy !== null}
            label={tc('acceptAll', { count: review.length })}
            onPress={() => reviewMany('accept', review)}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={busy !== null}
            label={tc('rejectAll', { count: review.length })}
            onPress={() => reviewMany('reject', review)}
          />
        </TwView>
      ) : null}
      {groups.map((group) => (
        <TwView key={group.day} className="gap-2">
          <LabelSm accessibilityRole="header" className="px-1">
            {group.heading}
          </LabelSm>
          {group.rows.map((row) => {
            const source =
              row.categoryId &&
              row.categorySource &&
              row.categorySource !== 'manual'
                ? ` (${tc(`sources.${row.categorySource}`)})`
                : '';
            return (
              <TransactionListCard
                key={row.id}
                row={row}
                category={
                  row.selectable
                    ? `${row.category}${source}`
                    : tc('notCategorizable')
                }
                selectable={row.selectable}
                selected={selected.has(row.id)}
                onSelectedChange={(checked) =>
                  setSelection(toggleSelection(selected, row.id, checked))
                }
                selectLabel={tc('selectRow', { name: row.title })}
                rename={async (name) => {
                  const updated = await renameTransaction(
                    row.id,
                    { displayName: name, isPrivate: row.name.ownPrivate },
                    gql,
                  );
                  merge([updated]);
                }}
                footer={
                  row.suggestion ? (
                    <SuggestionPill
                      label={row.suggestion.label}
                      busy={busy !== null}
                      onAccept={() => reviewMany('accept', [row.id])}
                      onReject={() => reviewMany('reject', [row.id])}
                    />
                  ) : undefined
                }
              />
            );
          })}
        </TwView>
      ))}
      {page.hasNextPage ? (
        <Button
          variant="outline"
          className="w-full"
          label={loadingMore ? t('common.loading') : t('common.loadMore')}
          disabled={loadingMore}
          onPress={loadMore}
        />
      ) : null}
      {selected.size > 0 ? (
        <MoveBar
          count={selected.size}
          categories={options}
          busy={busy === 'move'}
          onMove={move}
          onClear={() => setSelection(new Set())}
        />
      ) : null}
    </TwView>
  );
}
