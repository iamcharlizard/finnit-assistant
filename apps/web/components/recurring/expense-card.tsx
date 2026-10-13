'use client';

import { useTranslations } from 'next-intl';
import { MoreHorizontal, Pause, Pencil, Play, Trash2 } from 'lucide-react';

import { Badge } from '@finnit/ui/components/ui/badge';
import { Button } from '@finnit/ui/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@finnit/ui/components/ui/dropdown-menu';
import { Progress } from '@finnit/ui/components/ui/progress';
import { cn } from '@finnit/ui/lib/utils';

import type { ExpenseItem } from '@/lib/recurring/view';
import { KindIcon } from './kind-icon';

/** One recurring expense in "Mis pagos recurrentes". */
export function ExpenseCard({
  item,
  busy,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  item: ExpenseItem;
  busy: boolean;
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations();
  const facts = [item.accountLabel, item.categoryLabel].filter(Boolean);
  return (
    <li
      className={cn(
        'flex flex-col gap-3 rounded-card border border-outline bg-surface p-4',
        !item.active && 'bg-muted/40',
      )}
    >
      <div className="flex items-start gap-3">
        <KindIcon
          kind={item.kind}
          className={cn(!item.active && 'opacity-60')}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="truncate text-base font-bold text-on-background">
            {item.name}
          </h3>
          <p className="text-xs text-on-surface-variant">
            {t(`finance.recurringKinds.${item.kind}`)} · {item.frequencyLabel}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={busy}
              aria-label={t('recurring.actions.more', { name: item.name })}
              className="-mt-2 -mr-2"
            >
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil aria-hidden /> {t('recurring.actions.edit')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onToggleActive}>
              {item.active ? (
                <>
                  <Pause aria-hidden /> {t('recurring.actions.pause')}
                </>
              ) : (
                <>
                  <Play aria-hidden /> {t('recurring.actions.resume')}
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={onDelete}
              className="text-expense [&_svg]:text-expense"
            >
              <Trash2 aria-hidden /> {t('recurring.actions.delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-xl font-bold text-on-background tabular-nums">
            {item.amountLabel}
          </span>
          <span className="text-xs text-on-surface-variant">
            {item.monthlyLabel}
          </span>
        </div>
        <div className="flex flex-wrap justify-end gap-1">
          {item.active ? null : (
            <Badge variant="outline">
              <Pause aria-hidden /> {t('recurring.list.paused')}
            </Badge>
          )}
          <Badge variant="muted">
            {t(`recurring.trackingModes.${item.trackingMode}.label`)}
          </Badge>
        </div>
      </div>

      {item.installments ? (
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs text-on-surface-variant">
            <span>
              {t('recurring.list.installments', {
                paid: item.installments.paid,
                total: item.installments.total,
              })}
            </span>
            <span>{item.installments.percent}%</span>
          </div>
          <Progress
            value={item.installments.percent}
            aria-label={t('recurring.list.installments', {
              paid: item.installments.paid,
              total: item.installments.total,
            })}
          />
        </div>
      ) : null}

      {item.nextDueLabel || facts.length > 0 ? (
        <div className="flex flex-col gap-0.5 border-t border-outline pt-2 text-xs text-on-surface-variant">
          {item.nextDueLabel ? (
            <span className="font-medium text-on-background">
              {item.nextDueLabel}
            </span>
          ) : null}
          {facts.length > 0 ? <span>{facts.join(' · ')}</span> : null}
        </div>
      ) : null}
    </li>
  );
}
