'use client';

import { TransactionItem } from '@finnit/ui/components/finance/transaction-item';

import { CATEGORY_ICONS } from '@/lib/finance/category-icons';
import type { TransactionRow as TransactionRowData } from '@/lib/finance/transactions';

/** A compact transaction row (dashboard, cards). */
export function TransactionRow({
  row,
  className,
}: {
  row: TransactionRowData;
  className?: string;
}) {
  return (
    <TransactionItem
      merchant={row.title}
      category={row.category}
      time={row.status === 'pending' ? `${row.time} · Pendiente` : row.time}
      amount={row.amount}
      icon={CATEGORY_ICONS[row.iconKey]}
      variant={
        row.status === 'pending' || row.variant === 'neutral'
          ? 'pending'
          : row.variant
      }
      className={className}
    />
  );
}
