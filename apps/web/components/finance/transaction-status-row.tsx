'use client';

import { useTranslations } from 'next-intl';
import { TransactionItemWithStatus } from '@finnit/ui/components/finance/transaction-item-with-status';

import { CATEGORY_ICONS } from '@/lib/finance/category-icons';
import type { TransactionRow } from '@/lib/finance/transactions';

/** A transaction row with its status (history). */
export function TransactionStatusRow({ row }: { row: TransactionRow }) {
  const t = useTranslations('finance');
  const pending = row.status === 'pending';
  return (
    <TransactionItemWithStatus
      merchant={row.title}
      isPrivate={row.isPrivate}
      privateLabel={t('private')}
      category={row.category}
      time={row.time}
      amount={row.amount}
      statusLabel={pending ? t('pending') : t('completed')}
      statusVariant={pending ? 'pendiente' : 'completado'}
      itemVariant={
        pending || row.variant === 'neutral' ? 'pending' : row.variant
      }
      icon={CATEGORY_ICONS[row.iconKey]}
    />
  );
}
