'use client';

import { useTranslations } from 'next-intl';

import { TransactionItem } from '@finnit/ui/components/finance/transaction-item';

import { CATEGORY_ICONS } from '@/lib/finance/category-icons';
import type { CategorizeRow as Row } from '@/lib/categorize/view';
import { RowMenu } from './row-menu';
import { SuggestionChip } from './suggestion-chip';

/** A movement to categorize: checkbox, row, "⋮" menu and its suggestion. */
export function CategorizeRow({
  row,
  selected,
  busy,
  onSelectedChange,
  onReview,
  onRename,
}: {
  row: Row;
  selected: boolean;
  busy: boolean;
  onSelectedChange: (checked: boolean) => void;
  onReview: (action: 'accept' | 'reject') => void;
  onRename: () => void;
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
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1">
        <TransactionItem
          merchant={row.title}
          category={category}
          time={
            row.status === 'pending'
              ? t('finance.withPending', { time: row.time })
              : row.time
          }
          amount={row.amount}
          icon={CATEGORY_ICONS[row.iconKey]}
          variant={
            row.status === 'pending' || row.variant === 'neutral'
              ? 'pending'
              : row.variant
          }
          isPrivate={row.isPrivate}
          privateLabel={t('finance.private')}
          selectable={row.selectable}
          selected={selected}
          onSelectedChange={onSelectedChange}
          selectLabel={t('categorize.selectRow', { name: row.title })}
          onClick={
            row.selectable ? () => onSelectedChange(!selected) : undefined
          }
          className="min-w-0 flex-1"
        />
        <RowMenu name={row.title} onRename={onRename} />
      </div>
      {row.suggestion ? (
        <div className="pl-14">
          <SuggestionChip
            label={row.suggestion.label}
            busy={busy}
            onAccept={() => onReview('accept')}
            onReject={() => onReview('reject')}
          />
        </div>
      ) : null}
    </div>
  );
}
