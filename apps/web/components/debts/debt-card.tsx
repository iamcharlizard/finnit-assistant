'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  Banknote,
  CalendarClock,
  ChevronRight,
  CreditCard,
  HandCoins,
  Landmark,
  MoreHorizontal,
  Pencil,
  ShoppingBag,
  Trash2,
  UserRound,
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

import { CATEGORY_COLOR } from '@finnit/core/debts/insights-view';
import {
  isCardInstallments,
  type DebtCategory,
} from '@finnit/core/debts/types';
import type { DebtItem } from '@finnit/core/debts/view';

const TYPE_ICONS: Record<DebtCategory, typeof Landmark> = {
  institutional: Landmark,
  personal: UserRound,
  purchase_financing: ShoppingBag,
  card: CreditCard,
  other: HandCoins,
  msi: CalendarClock,
};

/** Its type for icon and color (same colors as the loan charts). */
function typeOf(item: DebtItem): DebtCategory {
  if (isCardInstallments(item.debt)) return 'msi';
  if (item.debt.loanType) return item.debt.loanType as DebtCategory;
  return item.kind === 'card' ? 'card' : 'other';
}

/** A soft tint of a chart color, for backgrounds. */
const tint = (color: string, percent: number) =>
  `color-mix(in oklab, ${color} ${percent}%, transparent)`;

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
  const type = typeOf(item);
  const Icon = TYPE_ICONS[type];
  const color = CATEGORY_COLOR[type];
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
      {/*
        The icon stretches to the height of the title, lender and pill
        (about 60px, hence w-15); a flex row's stretch sets the height.
      */}
      <div className="flex items-stretch gap-3">
        <span
          aria-hidden
          className="flex w-15 shrink-0 items-center justify-center rounded-chip"
          style={{ background: tint(color, 16), color }}
        >
          <Icon className="size-8" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="truncate text-base font-bold text-on-background">
            <Link href={item.href} className="hover:underline">
              {item.name}
            </Link>
          </h3>
          {item.debt.lenderName ? (
            <p className="truncate text-xs text-on-surface-variant">
              {item.debt.lenderName}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-1">
            {/* Tinted with the type's color; the text keeps the ink color. */}
            <Badge
              variant="muted"
              className="gap-1.5 text-on-background"
              style={{ background: tint(color, 18) }}
            >
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ background: color }}
              />
              {item.debt.loanType
                ? t(`loanTypes.${item.debt.loanType}`)
                : t(`kinds.${item.kind}`)}
            </Badge>
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
              className="-mt-2 -mr-2 self-start"
            >
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {item.paidOff || isCardInstallments(item.debt) ? null : (
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
        {item.nextPayment ? (
          <span className="font-medium text-on-background">
            {t('card.nextPayment', { date: item.nextPayment })}
          </span>
        ) : null}
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

      {/* Pinned to the bottom so cards in a row line up. */}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
        {item.paidOff ? (
          <span />
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={onPay}
          >
            <Banknote aria-hidden /> {t('card.pay')}
          </Button>
        )}
        <Button type="button" variant="ghost" size="sm" asChild>
          <Link href={item.href}>
            {t('card.details')} <ChevronRight aria-hidden />
          </Link>
        </Button>
      </div>
    </li>
  );
}
