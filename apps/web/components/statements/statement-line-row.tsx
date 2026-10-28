'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  EyeOff,
  Link2,
  Link2Off,
  MoreVertical,
  Repeat,
  RotateCcw,
} from 'lucide-react';

import { Badge } from '@finnit/ui/components/ui/badge';
import { Button } from '@finnit/ui/components/ui/button';
import { Combobox } from '@finnit/ui/components/ui/combobox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@finnit/ui/components/ui/dropdown-menu';
import { cn } from '@finnit/ui/lib/utils';

import type { PickerOption } from '@/lib/new-entry/options';
import type { LineStatus } from '@/lib/statements/types';
import type { StatementLineView } from '@/lib/statements/view';

const STATUS_BADGE: Record<
  LineStatus,
  'brand' | 'muted' | 'success' | 'outline'
> = {
  pending: 'brand',
  matched: 'muted',
  created: 'success',
  ignored: 'outline',
};

/**
 * One extracted movement. While the statement is in review: category
 * (new lines), ignore/restore, link to a movement already registered, or
 * unlink it.
 */
export function StatementLineRow({
  line,
  editable,
  busy,
  categories,
  onCategory,
  onStatus,
  onLink,
  onUnlink,
}: {
  line: StatementLineView;
  editable: boolean;
  busy: boolean;
  /** Category options for this line's direction. */
  categories: PickerOption[];
  onCategory: (categoryId: string | null) => void;
  onStatus: (status: 'pending' | 'ignored') => void;
  onLink: () => void;
  onUnlink: () => void;
}) {
  const t = useTranslations('statements');
  const ignored = line.status === 'ignored';
  const showCategory = line.kind !== 'payment';

  return (
    <li
      className={cn(
        'flex flex-col gap-2 rounded-2xl bg-surface p-3.5',
        ignored && 'opacity-60',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className={cn(
              'text-sm font-medium break-words text-on-background',
              ignored && 'line-through',
            )}
          >
            {line.description}
          </p>
          <p className="mt-0.5 text-xs text-on-surface-variant">
            {line.date} · {line.kindLabel}
            {line.installments
              ? line.kind === 'installment'
                ? ` ${line.installments}`
                : ` · ${t('lines.installments', { value: line.installments })}`
              : ''}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={cn(
              'text-sm font-bold tabular-nums',
              line.variant === 'expense' ? 'text-expense' : 'text-income',
            )}
          >
            {line.amount}
          </span>
          <Badge variant={STATUS_BADGE[line.status]}>{line.statusLabel}</Badge>
        </div>
      </div>

      {line.recurring || line.matchedTransactionHref ? (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {line.matchedTransactionHref ? (
            <Link
              href={line.matchedTransactionHref}
              className="inline-flex items-center gap-1 font-medium text-brand-ink underline-offset-4 hover:underline"
            >
              <Link2 aria-hidden className="size-3.5" />
              {t('lines.viewTransaction')}
            </Link>
          ) : null}
          {line.recurring ? (
            <Link
              href={line.recurring.href}
              className="inline-flex items-center gap-1 font-medium text-brand-ink underline-offset-4 hover:underline"
            >
              <Repeat aria-hidden className="size-3.5" />
              {t('lines.recurring', { name: line.recurring.label })}
            </Link>
          ) : null}
        </div>
      ) : null}

      {editable ? (
        <div className="flex items-center gap-2">
          {line.status === 'pending' && showCategory ? (
            <Combobox
              aria-label={t('lines.category', { name: line.description })}
              options={categories}
              value={line.categoryId ?? undefined}
              onChange={(value) => onCategory(value ?? null)}
              placeholder={t('lines.categoryPlaceholder')}
              searchPlaceholder={t('lines.categorySearch')}
              emptyText={t('lines.noResults')}
              disabled={busy}
              clearable
              className="min-h-9 py-1.5 text-sm"
            />
          ) : (
            <span className="min-w-0 flex-1 truncate text-xs text-on-surface-variant">
              {line.status === 'pending' ? null : line.categoryLabel}
            </span>
          )}
          {ignored ? (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => onStatus('pending')}
              className="ml-auto"
            >
              <RotateCcw aria-hidden /> {t('lines.restore')}
            </Button>
          ) : (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={busy}
                  aria-label={t('lines.menu', { name: line.description })}
                  className="ml-auto shrink-0 text-on-surface-variant"
                >
                  <MoreVertical aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {line.status === 'matched' ? (
                  <DropdownMenuItem onSelect={onUnlink}>
                    <Link2Off /> {t('lines.unlink')}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onSelect={onLink}>
                    <Link2 /> {t('lines.link')}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={() => onStatus('ignored')}>
                  <EyeOff /> {t('lines.ignore')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      ) : line.categoryLabel && line.status !== 'ignored' ? (
        <p className="text-xs text-on-surface-variant">{line.categoryLabel}</p>
      ) : null}
    </li>
  );
}
