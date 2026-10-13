'use client';

import { useTranslations } from 'next-intl';
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
  const t = useTranslations('finance');
  return (
    <TransactionItem
      merchant={row.title}
      category={row.category}
      time={
        row.status === 'pending'
          ? t('withPending', { time: row.time })
          : row.time
      }
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
