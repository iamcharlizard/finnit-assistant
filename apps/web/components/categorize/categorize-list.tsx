'use client';

import * as React from 'react';
import { Sparkles } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { LabelSm } from '@finnit/ui/components/ui/typography';
import { toast } from '@finnit/ui/components/ui/toaster';

import { useCategorizePages } from '@/hooks/use-categorize-pages';
import {
  categorize,
  categorizeErrorMessage,
  reviewSuggestions,
  suggestCategories,
} from '@/lib/categorize/api';
import type { CategorizeFilters } from '@/lib/categorize/filters';
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
} from '@/lib/categorize/selection';
import type {
  CategorizeCategory,
  CategorizePageData,
} from '@/lib/categorize/types';
import {
  toCategorizeRow,
  type CategorizeRow as Row,
} from '@/lib/categorize/view';
import { indexCategories } from '@/lib/finance/categories';
import type { DayKey } from '@/lib/finance/dates';
import { groupByDay } from '@/lib/finance/transactions';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';
import { categoryOptions } from '@/lib/new-entry/options';
import { AiNotice } from './ai-notice';
import { CategorizeRow } from './categorize-row';
import { EmptyList } from './empty-list';
import { MoveBar } from './move-bar';
import { RenameDialog } from './rename-dialog';
import { SelectAllToggle } from './select-all-toggle';

type Busy = 'move' | 'suggest' | 'accept' | 'reject' | `row:${string}` | null;

/**
 * The movements to categorize, grouped by day: select one or many, move
 * them to a category, ask the AI for suggestions and accept or reject them.
 */
export function CategorizeList({
  initial,
  filters,
  categories,
  today,
}: {
  initial: CategorizePageData;
  filters: CategorizeFilters;
  categories: CategorizeCategory[];
  today: DayKey;
}) {
  const l = useLocalizer();
  const { t, locale } = l;
  const pages = useCategorizePages(initial, filters);
  const { transactions, totalCount, hasNextPage, loading, error } = pages;
  const [selection, setSelection] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [busy, setBusy] = React.useState<Busy>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [renaming, setRenaming] = React.useState<Row | null>(null);

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
    () => categoryOptions(categories, 'expense', locale),
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
    });

  if (rows.length === 0) {
    return <EmptyList filters={filters} today={today} />;
  }

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
            <LabelSm as="h2" className="mb-3 block px-1">
              {group.heading}
            </LabelSm>
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
                  onRename={() => setRenaming(row)}
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
        <Button
          variant="outline"
          className="w-full"
          onClick={pages.loadMore}
          disabled={loading}
        >
          {loading ? t('common.loading') : t('common.loadMore')}
        </Button>
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

      {renaming ? (
        <RenameDialog
          row={renaming}
          onClose={() => setRenaming(null)}
          onSaved={(updated, removed) => {
            pages.merge([updated]);
            setRenaming(null);
            toast.success(
              t(
                removed
                  ? 'categorize.toasts.aliasRemoved'
                  : 'categorize.toasts.renamed',
              ),
            );
          }}
        />
      ) : null}
    </div>
  );
}
