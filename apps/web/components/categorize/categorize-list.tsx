'use client';

import * as React from 'react';
import { Sparkles } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { LabelSm } from '@finnit/ui/components/ui/typography';
import { toast } from '@finnit/ui/components/ui/toaster';

import { useCategorizePages } from '@/hooks/use-categorize-pages';
import {
  useLoadMoreSentinel,
  useShownInUrl,
} from '@/hooks/use-load-more-sentinel';
import { SHOWN_PARAM, shownParam } from '@finnit/core/history/filters';
import {
  categorize,
  categorizeErrorMessage,
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
  CategorizeCategory,
  CategorizePageData,
} from '@finnit/core/categorize/types';
import { toCategorizeRow } from '@finnit/core/categorize/view';
import { indexCategories } from '@finnit/core/finance/categories';
import type { DayKey } from '@finnit/core/finance/dates';
import { groupByDay } from '@finnit/core/finance/transactions';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';
import { categoryOptions } from '@finnit/core/new-entry/options';
import { AiNotice } from './ai-notice';
import { CategorizeRow } from './categorize-row';
import { MoveBar } from './move-bar';
import { renameTransaction } from '@finnit/core/categorize/api';
import { SelectAllToggle } from './select-all-toggle';

type Busy = 'move' | 'suggest' | 'accept' | 'reject' | `row:${string}` | null;

/**
 * "Por clasificar" in the history: the movements without a category,
 * grouped by day: select one or many, move them to a category, ask the AI
 * for suggestions and accept or reject them.
 */
export function CategorizeList({
  initial,
  filters,
  categories,
  today,
  empty,
  onChange,
}: {
  initial: CategorizePageData;
  /** The API's TransactionFilters of the list (the history's, in review). */
  filters: ApiTransactionFilters;
  categories: CategorizeCategory[];
  today: DayKey;
  /** Shown when nothing is left. */
  empty: React.ReactNode;
  /** Something was categorized (the page's counts and charts change). */
  onChange?: () => void;
}) {
  const l = useLocalizer();
  const { t, locale } = l;
  const pages = useCategorizePages(initial, filters);
  const { transactions, totalCount, hasNextPage, loading, error } = pages;
  useShownInUrl(transactions.length, shownParam, SHOWN_PARAM);
  // Infinite scroll, like the history.
  const sentinel = useLoadMoreSentinel(
    () => void pages.loadMore(),
    hasNextPage && !error && !loading,
  );
  const [selection, setSelection] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [busy, setBusy] = React.useState<Busy>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const index = React.useMemo(() => indexCategories(categories), [categories]);
  const rows = React.useMemo(
    () => transactions.map((tx) => toCategorizeRow(tx, index, l)),
    [transactions, index, l],
  );
  const groups = React.useMemo(
    () => groupByDay(rows, today, locale),
    [rows, today, locale],
  );
  const pickerOptions = React.useMemo(
    () => categoryOptions(categories, 'any', locale),
    [categories, locale],
  );
  // Rows that left the list (after a reload) can't stay selected.
  const selected = React.useMemo(
    () => pruneSelection(selection, rows),
    [selection, rows],
  );
  const review = reviewTargets(rows, selected);

  const fail = (e: unknown) => toast.error(categorizeErrorMessage(e, t));

  async function run(kind: Exclude<Busy, null>, action: () => Promise<void>) {
    if (busy) return;
    setBusy(kind);
    try {
      await action();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  }

  const move = (categoryId: string, remember: boolean) =>
    run('move', async () => {
      const ids = selectedIds(rows, selected);
      const changed = await categorize(ids, categoryId, remember, gql);
      toast.success(t('categorize.toasts.categorized', { count: changed }));
      setSelection(new Set());
      await pages.reload();
      onChange?.();
    });

  const suggest = () =>
    run('suggest', async () => {
      const { ids, truncated } = suggestionTargets(rows, selected);
      setNotice(
        truncated ? t('categorize.tooMany', { max: SUGGEST_MAX }) : null,
      );
      const returned = await suggestCategories(ids, gql);
      pages.merge(returned);
      const outcome = suggestionOutcome(ids, returned);
      if (outcome.unavailable) setNotice(t('categorize.aiUnavailable'));
      else {
        toast.success(
          t('categorize.toasts.suggested', { count: outcome.suggested }),
        );
      }
    });

  const reviewMany = (
    action: 'accept' | 'reject',
    ids: string[],
    kind: Exclude<Busy, null>,
  ) =>
    run(kind, async () => {
      const count = await reviewSuggestions(action, ids, gql);
      toast.success(
        t(
          action === 'accept'
            ? 'categorize.toasts.accepted'
            : 'categorize.toasts.rejected',
          { count },
        ),
      );
      await pages.reload();
      onChange?.();
    });

  if (rows.length === 0) return <>{empty}</>;

  const suggestTargets = suggestionTargets(rows, selected);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SelectAllToggle
          checked={isAllSelected(rows, selected)}
          onToggle={() => setSelection(toggleAll(rows, selected))}
        />
        <p
          className="mr-auto px-1 text-xs text-on-surface-variant"
          aria-live="polite"
        >
          {t('categorize.count', {
            shown: String(rows.length),
            total: totalCount,
          })}
        </p>
        <Button
          variant="secondary"
          size="sm"
          disabled={busy !== null || suggestTargets.ids.length === 0}
          onClick={suggest}
          title={t('categorize.suggestHint')}
        >
          <Sparkles aria-hidden />
          {busy === 'suggest'
            ? t('categorize.suggesting')
            : t('categorize.suggest')}
        </Button>
      </div>

      {review.length > 0 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={() => reviewMany('accept', review, 'accept')}
          >
            {t('categorize.acceptAll', { count: review.length })}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={() => reviewMany('reject', review, 'reject')}
          >
            {t('categorize.rejectAll', { count: review.length })}
          </Button>
        </div>
      ) : null}

      {notice ? (
        <AiNotice message={notice} onDismiss={() => setNotice(null)} />
      ) : null}

      <div aria-busy={busy === 'suggest' || undefined}>
        {groups.map((group) => (
          <section key={group.day} className="mb-8">
            {/*
              Like the history's: the day stays under the toolbar until its
              last movement scrolls past (--history-day-top, useStickyTops).
            */}
            <div className="glass sticky top-[var(--history-day-top,12rem)] z-10 mb-3 flex items-baseline rounded-full border border-glass-border bg-glass px-4 py-2 shadow-elevation">
              <LabelSm as="h2" className="block">
                {group.heading}
              </LabelSm>
            </div>
            <div className="flex flex-col gap-2">
              {group.rows.map((row) => (
                <CategorizeRow
                  key={row.id}
                  row={row}
                  selected={selected.has(row.id)}
                  busy={busy !== null}
                  onSelectedChange={(checked) =>
                    setSelection(toggleSelection(selected, row.id, checked))
                  }
                  onReview={(action) =>
                    reviewMany(action, [row.id], `row:${row.id}`)
                  }
                  onRename={async (name) => {
                    const updated = await renameTransaction(
                      row.id,
                      { displayName: name, isPrivate: row.name.ownPrivate },
                      gql,
                    );
                    pages.merge([updated]);
                  }}
                  // A movement categorized there leaves the list (filters apply again).
                  onDetailChange={() => {
                    void pages.reload();
                    onChange?.();
                  }}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {error ? (
        <p role="alert" className="mb-3 text-sm text-expense">
          {error}
        </p>
      ) : null}
      {hasNextPage ? (
        <div ref={sentinel} className="flex justify-center py-4">
          {loading ? (
            <p className="text-xs text-on-surface-variant" aria-live="polite">
              {t('common.loading')}
            </p>
          ) : error ? (
            <Button variant="outline" size="sm" onClick={pages.loadMore}>
              {t('common.retry')}
            </Button>
          ) : null}
        </div>
      ) : null}

      {selected.size > 0 ? (
        <MoveBar
          count={selected.size}
          categories={pickerOptions}
          busy={busy === 'move'}
          onMove={move}
          onClear={() => setSelection(new Set())}
        />
      ) : null}
    </div>
  );
}
