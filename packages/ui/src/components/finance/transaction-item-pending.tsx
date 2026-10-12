'use client';

import { Clock } from 'lucide-react';

import { TransactionItem, type TransactionItemProps } from './transaction-item';

type TransactionItemPendingProps = Omit<
  TransactionItemProps,
  'variant' | 'icon'
> &
  Partial<Pick<TransactionItemProps, 'icon'>>;

function TransactionItemPending({
  icon = Clock,
  ...props
}: TransactionItemPendingProps) {
  return <TransactionItem {...props} icon={icon} variant="pending" />;
}

export { TransactionItemPending, type TransactionItemPendingProps };
