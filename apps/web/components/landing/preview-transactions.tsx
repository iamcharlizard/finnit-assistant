'use client';

import { Banknote, Fuel, ShoppingBasket } from 'lucide-react';

import { TransactionItem } from '@finnit/ui/components/finance/transaction-item';

const ICONS = {
  groceries: ShoppingBasket,
  payroll: Banknote,
  fuel: Fuel,
} as const;

export interface PreviewTransaction {
  merchant: string;
  category: string;
  time: string;
  amount: string;
  icon: keyof typeof ICONS;
  variant: 'income' | 'expense';
}

/**
 * Sample movements for the landing's dashboard preview. A client component
 * because the list items take icon components, which can't cross from the
 * server; the server passes the icon's name instead.
 */
export function PreviewTransactions({
  items,
}: {
  items: PreviewTransaction[];
}) {
  return (
    <>
      {items.map(({ icon, ...item }) => (
        <TransactionItem key={item.merchant} {...item} icon={ICONS[icon]} />
      ))}
    </>
  );
}
