'use client';

import { TransactionListCard } from '@/components/finance/transaction-card';
import type { HistoryRow as Row } from '@finnit/core/history/view';

/**
 * A history movement: the card opens its detail (drawer or modal), where
 * its name rules, transfer conversion and the rest live; the pencil by the
 * name renames just this one.
 */
export function HistoryRow({
  row,
  onRenamed,
}: {
  row: Row;
  onRenamed: () => void;
}) {
  return <TransactionListCard row={row} showStatus onRenamed={onRenamed} />;
}
