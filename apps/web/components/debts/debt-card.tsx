'use client';

import { useTranslations } from 'next-intl';
import {
  Banknote,
  CreditCard,
  HandCoins,
  Landmark,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react';

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

import type { DebtKind } from '@/lib/debts/types';
import type { DebtItem } from '@/lib/debts/view';

const KIND_ICONS: Record<DebtKind, typeof Landmark> = {
  loan: Landmark,
  card: CreditCard,
  other: HandCoins,
};

/** One debt: what is left, how much is paid, its terms and actions. */
export function DebtCard({
  item,
  busy,
  onPay,
  onEdit,
  onDelete,
}: {
  item: DebtItem;
  busy: boolean;
  onPay: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations('debts');
  const Icon = KIND_ICONS[item.kind];
  const facts = [
    item.rate ? t('card.rate', { rate: item.rate }) : t('card.noRate'),
    item.minPayment ? t('card.minPayment', { amount: item.minPayment }) : null,
    item.accountLabel
      ? t('card.account', { account: item.accountLabel })
      : null,
  ].filter(Boolean);

  return (
    <li
      className={cn(
        'flex flex-col gap-3 rounded-card border border-outline bg-surface p-4',
        item.paidOff && 'bg-muted/40',
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-chip bg-track text-on-surface-variant"
        >
          <Icon className="size-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="truncate text-base font-bold text-on-background">
            {item.name}
          </h3>
          <div className="flex flex-wrap gap-1">
            <Badge variant="muted">{t(`kinds.${item.kind}`)}</Badge>
            {item.paidOff ? (
              <Badge variant="income">{t('card.paidOff')}</Badge>
            ) : null}
            {item.overdue ? (
              <Badge variant="expense">{t('card.overdue')}</Badge>
            ) : null}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={busy}
              aria-label={t('card.more', { name: item.name })}
              className="-mt-2 -mr-2"
            >
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {item.paidOff ? null : (
              <DropdownMenuItem onSelect={onPay}>
                <Banknote aria-hidden /> {t('card.pay')}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil aria-hidden /> {t('card.edit')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={onDelete}
              className="text-expense [&_svg]:text-expense"
            >
              <Trash2 aria-hidden /> {t('card.delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-on-surface-variant">
          {t('card.remaining')}
        </span>
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-2xl font-bold text-on-background tabular-nums">
            {item.remaining}
          </span>
          <span className="text-sm text-on-surface-variant">
            {t('card.of', { amount: item.principal })}
          </span>
        </p>
        <Progress
          value={item.paidPercent}
          indicatorColor="var(--income)"
          aria-label={t('card.paidLabel', { percent: item.paidPercent })}
          className="mt-1 h-2"
        />
        <span className="text-xs text-on-surface-variant">
          {t('card.paid', { amount: item.paid, percent: item.paidPercent })}
        </span>
      </div>

      <div className="flex flex-col gap-0.5 border-t border-outline pt-2 text-xs text-on-surface-variant">
        <span>{facts.join(' · ')}</span>
        {item.dueLabel ? (
          <span
            className={cn(
              'font-medium',
              item.overdue ? 'text-expense' : 'text-on-background',
            )}
          >
            {t('card.due', { date: item.dueLabel })}
          </span>
        ) : null}
      </div>

      {item.paidOff ? null : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={onPay}
          className="self-start"
        >
          <Banknote aria-hidden /> {t('card.pay')}
        </Button>
      )}
    </li>
  );
}
