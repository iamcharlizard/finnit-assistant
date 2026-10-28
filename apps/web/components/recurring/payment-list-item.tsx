'use client';

import { useTranslations } from 'next-intl';
import { Check, Pencil, RotateCcw, SkipForward } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { cn } from '@finnit/ui/lib/utils';

import type { PaymentAction } from '@/lib/recurring/api';
import type { PaymentItem } from '@/lib/recurring/view';
import { KindIcon } from './kind-icon';
import { PaymentStatusBadge } from './payment-status-badge';

const ACTION_ICONS = { pay: Check, skip: SkipForward, reopen: RotateCcw };

/** A due payment with its status and what can be done with it. */
export function PaymentListItem({
  item,
  busy,
  onAction,
  onEdit,
}: {
  item: PaymentItem;
  busy: boolean;
  onAction: (action: PaymentAction) => void;
  /** Absent when the expense can't be opened (e.g. it was just deleted). */
  onEdit?: () => void;
}) {
  const t = useTranslations('recurring');
  const details = [item.accountLabel, item.dateLabel]
    .filter(Boolean)
    .join(' · ');
  return (
    <li
      className={cn(
        'flex flex-col gap-3 rounded-2xl border border-outline bg-surface p-3',
        item.status === 'skipped' && 'opacity-75',
      )}
    >
      <div className="flex items-start gap-3">
        <KindIcon kind={item.kind} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-start justify-between gap-2">
            <span
              className={cn(
                'min-w-0 truncate text-sm font-medium text-on-background',
                item.status === 'skipped' && 'line-through',
              )}
            >
              {item.name}
            </span>
            <span className="shrink-0 text-sm font-bold text-on-background tabular-nums">
              {item.amountLabel}
            </span>
          </div>
          <span className="text-xs text-on-surface-variant">{details}</span>
          <PaymentStatusBadge status={item.status} overdue={item.overdue} />
        </div>
      </div>
      {item.actions.length > 0 || onEdit ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {item.actions.map((action) => {
            const Icon = ACTION_ICONS[action];
            return (
              <Button
                key={action}
                type="button"
                size="sm"
                variant={action === 'pay' ? 'secondary' : 'outline'}
                disabled={busy}
                onClick={() => onAction(action)}
                aria-label={t(`actions.${action}Label`, { name: item.name })}
              >
                <Icon aria-hidden /> {t(`actions.${action}`)}
              </Button>
            );
          })}
          {onEdit ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={onEdit}
              aria-label={t('actions.editLabel', { name: item.name })}
            >
              <Pencil aria-hidden /> {t('actions.edit')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
