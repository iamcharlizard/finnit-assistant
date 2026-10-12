'use client';

import type { LucideIcon } from 'lucide-react';

import { cn } from '../../lib/utils';

type TransactionVariant = 'income' | 'expense' | 'pending';

interface TransactionItemProps {
  merchant: string;
  category: string;
  time: string;
  amount: string;
  icon: LucideIcon;
  variant: TransactionVariant;
  onClick?: () => void;
  className?: string;
}

const VARIANT_STYLES: Record<
  TransactionVariant,
  { amount: string; iconBg: string }
> = {
  income: { amount: 'text-income', iconBg: 'bg-income/10 dark:bg-income/20' },
  expense: {
    amount: 'text-expense',
    iconBg: 'bg-expense/8 dark:bg-expense/15',
  },
  pending: { amount: 'text-on-surface-variant', iconBg: 'bg-track' },
};

/** Shared row used by TransactionItemIncome/Expense/Pending. */
function TransactionItem({
  merchant,
  category,
  time,
  amount,
  icon: Icon,
  variant,
  onClick,
  className,
}: TransactionItemProps) {
  const styles = VARIANT_STYLES[variant];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl bg-surface p-4 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50',
        className,
      )}
    >
      <span className="flex min-w-0 flex-1 items-center gap-4">
        <span
          className={cn(
            'flex size-12 shrink-0 items-center justify-center rounded-chip',
            styles.iconBg,
          )}
        >
          <Icon aria-hidden className="size-[22px] text-on-surface-variant" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-on-background">
            {merchant}
          </span>
          <span className="mt-0.5 block truncate text-xs text-on-surface-variant">
            {category} · {time}
          </span>
        </span>
      </span>
      <span className={cn('shrink-0 text-sm font-bold', styles.amount)}>
        {amount}
      </span>
    </button>
  );
}

export { TransactionItem, type TransactionItemProps, type TransactionVariant };
