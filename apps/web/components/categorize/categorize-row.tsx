'use client';

import { useTranslations } from 'next-intl';

import { TransactionListCard } from '@/components/finance/transaction-card';
import type { CategorizeRow as Row } from '@finnit/core/categorize/view';
import { SuggestionChip } from './suggestion-chip';

/**
 * A movement to categorize: checkbox, the card (opens the detail; the
 * pencil renames this one) and, inside it, its pending suggestion.
 */
export function CategorizeRow({
  row,
  selected,
  busy,
  onSelectedChange,
  onReview,
  onRename,
  onDetailChange,
}: {
  row: Row;
  selected: boolean;
  busy: boolean;
  onSelectedChange: (checked: boolean) => void;
  onReview: (action: 'accept' | 'reject') => void;
  /** Saves this movement's own name ("" removes it). */
  onRename: (name: string) => Promise<void>;
  /** The movement changed in its detail (reload the list). */
  onDetailChange: () => void;
}) {
  const t = useTranslations();
  const source =
    row.categoryId && row.categorySource && row.categorySource !== 'manual'
      ? ` (${t(`categorize.sources.${row.categorySource}`)})`
      : '';
  const category = row.selectable
    ? `${row.category}${source}`
    : t('categorize.notCategorizable');

  return (
    <TransactionListCard
      row={row}
      category={category}
      selectable={row.selectable}
      selected={selected}
      onSelectedChange={onSelectedChange}
      selectLabel={t('categorize.selectRow', { name: row.title })}
      rename={onRename}
      onDetailChange={onDetailChange}
      footer={
        row.suggestion ? (
          <SuggestionChip
            label={row.suggestion.label}
            busy={busy}
            onAccept={() => onReview('accept')}
            onReject={() => onReview('reject')}
          />
        ) : null
      }
    />
  );
}
