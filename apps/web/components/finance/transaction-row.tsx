'use client';

import { useRouter } from 'next/navigation';

import { TransactionListCard } from '@/components/finance/transaction-card';
import type { TransactionRow as TransactionRowData } from '@/lib/finance/transactions';

/** A compact transaction card (account movements): opens the detail, pencil renames. */
export function TransactionRow({
  row,
  className,
}: {
  row: TransactionRowData;
  className?: string;
}) {
  const router = useRouter();
  return (
    <TransactionListCard
      row={row}
      onRenamed={() => router.refresh()}
      className={className}
    />
  );
}
