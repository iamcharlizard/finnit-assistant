'use client';

import { Lock, type LucideIcon } from 'lucide-react';

import { cn } from '../../lib/utils';
import {
  TransactionItemSelection,
  type TransactionSelectionProps,
} from './transaction-item-selection';

type StatusVariant = 'completado' | 'info' | 'pendiente' | 'fallida';
type ItemVariant = 'income' | 'expense' | 'pending' | 'failed';

interface TransactionItemWithStatusProps extends TransactionSelectionProps {
  merchant: string;
  category: string;
  time: string;
  amount: string;
  statusLabel: string;
  statusVariant: StatusVariant;
  itemVariant: ItemVariant;
  icon: LucideIcon;
  onClick?: () => void;
  className?: string;
  /** Shows a lock before the name (a private alias hides the original). */
  isPrivate?: boolean;
  /** Accessible name of the lock. Defaults to "Private". */
  privateLabel?: string;
}

const ICON_BG: Record<ItemVariant, string> = {
  income: 'bg-income/10 dark:bg-income/20',
  pending: 'bg-track',
  expense: 'bg-expense/8 dark:bg-expense/15',
  failed: 'bg-expense/8 dark:bg-expense/15',
};

const AMOUNT_COLOR: Record<ItemVariant, string> = {
  income: 'text-income',
  pending: 'text-on-surface-variant',
  expense: 'text-expense',
  failed: 'text-expense',
};

const STATUS_COLOR: Record<StatusVariant, string> = {
  completado: 'text-income',
  info: 'text-on-surface-variant',
  pendiente: 'text-on-surface-variant',
  fallida: 'text-expense',
};

function TransactionItemWithStatus({
  merchant,
  category,
  time,
  amount,
  statusLabel,
  statusVariant,
  itemVariant,
  icon: Icon,
  onClick,
  className,
  selectable,
  selected,
  onSelectedChange,
  selectLabel,
  isPrivate,
  privateLabel = 'Private',
}: TransactionItemWithStatusProps) {
  const row = (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl bg-surface p-4 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50',
        !selectable && className,
      )}
    >
      <span className="flex min-w-0 flex-1 items-center gap-4">
        <span
          className={cn(
            'flex size-12 shrink-0 items-center justify-center rounded-chip',
            ICON_BG[itemVariant],
          )}
        >
          <Icon aria-hidden className="size-[22px] text-on-surface-variant" />
        </span>
        <span className="min-w-0">
          <span className="flex min-w-0 items-center gap-1 text-sm font-medium text-on-background">
            {isPrivate ? (
              <Lock
                role="img"
                aria-label={privateLabel}
                className="size-3.5 shrink-0 text-on-surface-variant"
              />
            ) : null}
            <span className="truncate">{merchant}</span>
          </span>
          <span className="mt-0.5 block truncate text-xs text-on-surface-variant">
            {category} · {time}
          </span>
        </span>
      </span>
      <span className="ml-2 flex shrink-0 flex-col items-end">
        <span className={cn('text-sm font-bold', AMOUNT_COLOR[itemVariant])}>
          {amount}
        </span>
        <span className={cn('mt-0.5 text-[11px]', STATUS_COLOR[statusVariant])}>
          {statusLabel}
        </span>
      </span>
    </button>
  );

  return (
    <TransactionItemSelection
      selectable={selectable}
      selected={selected}
      onSelectedChange={onSelectedChange}
      selectLabel={selectLabel}
      merchant={merchant}
      className={className}
    >
      {row}
    </TransactionItemSelection>
  );
}

export {
  TransactionItemWithStatus,
  type TransactionItemWithStatusProps,
  type StatusVariant,
  type ItemVariant,
};
