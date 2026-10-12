'use client';

import { CircleArrowDown } from 'lucide-react';

import { TransactionItem, type TransactionItemProps } from './transaction-item';

type TransactionItemIncomeProps = Omit<
  TransactionItemProps,
  'variant' | 'icon'
> &
  Partial<Pick<TransactionItemProps, 'icon'>>;

function TransactionItemIncome({
  icon = CircleArrowDown,
  ...props
}: TransactionItemIncomeProps) {
  return <TransactionItem {...props} icon={icon} variant="income" />;
}

export { TransactionItemIncome, type TransactionItemIncomeProps };
