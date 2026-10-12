'use client';

import { ShoppingCart } from 'lucide-react';

import { TransactionItem, type TransactionItemProps } from './transaction-item';

type TransactionItemExpenseProps = Omit<
  TransactionItemProps,
  'variant' | 'icon'
> &
  Partial<Pick<TransactionItemProps, 'icon'>>;

function TransactionItemExpense({
  icon = ShoppingCart,
  ...props
}: TransactionItemExpenseProps) {
  return <TransactionItem {...props} icon={icon} variant="expense" />;
}

export { TransactionItemExpense, type TransactionItemExpenseProps };
