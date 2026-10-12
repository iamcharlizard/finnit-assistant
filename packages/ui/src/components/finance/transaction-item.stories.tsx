import type { Meta, StoryObj } from '@storybook/react-vite';
import { Plane, Utensils } from 'lucide-react';

import { TransactionItem } from './transaction-item';
import { TransactionItemExpense } from './transaction-item-expense';
import { TransactionItemIncome } from './transaction-item-income';
import { TransactionItemPending } from './transaction-item-pending';

const meta = {
  title: 'Finance/TransactionItem',
  component: TransactionItem,
  args: {
    merchant: 'Amazon Store',
    category: 'Compras',
    time: 'Hoy, 14:20',
    amount: '-$142.50',
    icon: Utensils,
    variant: 'expense',
  },
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TransactionItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <TransactionItemExpense
        merchant="Amazon Store"
        category="Compras"
        time="Hoy, 14:20"
        amount="-$142.50"
      />
      <TransactionItemIncome
        merchant="Depósito de Nómina"
        category="Ingresos"
        time="15 Oct, 09:00"
        amount="+$3,200.00"
      />
      <TransactionItemPending
        merchant="Sushi Zen Master"
        category="Restaurantes"
        time="21:05"
        amount="-$84.20"
      />
      <TransactionItemExpense
        merchant="Iberia Airlines"
        category="Viajes"
        time="12 Oct, 11:45"
        amount="-$540.20"
        icon={Plane}
      />
    </div>
  ),
};
