import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Plane } from 'lucide-react';

import { TransactionItemExpense } from './transaction-item-expense';
import { TransactionItemIncome } from './transaction-item-income';
import { TransactionItemWithStatus } from './transaction-item-with-status';

const meta = {
  title: 'Finance/TransactionItem/Selection',
  component: TransactionItemExpense,
  args: {
    merchant: 'Amazon Store',
    category: 'Compras',
    time: 'Hoy, 14:20',
    amount: '-$142.50',
  },
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TransactionItemExpense>;

export default meta;
type Story = StoryObj<typeof meta>;

function SelectableList() {
  const [selected, setSelected] = React.useState<Set<string>>(
    () => new Set(['t2']),
  );
  const toggle = (id: string) => (checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-on-surface-variant" aria-live="polite">
        {selected.size} seleccionadas
      </p>
      <TransactionItemExpense
        selectable
        selected={selected.has('t1')}
        onSelectedChange={toggle('t1')}
        selectLabel="Seleccionar Amazon Store"
        merchant="Amazon Store"
        category="Compras"
        time="Hoy, 14:20"
        amount="-$142.50"
      />
      <TransactionItemIncome
        selectable
        selected={selected.has('t2')}
        onSelectedChange={toggle('t2')}
        selectLabel="Seleccionar Depósito de Nómina"
        merchant="Depósito de Nómina"
        category="Ingresos"
        time="15 Oct, 09:00"
        amount="+$3,200.00"
      />
      <TransactionItemWithStatus
        selectable
        selected={selected.has('t3')}
        onSelectedChange={toggle('t3')}
        merchant="Iberia Airlines"
        category="Viajes"
        time="12 Oct, 11:45"
        amount="-$540.20"
        icon={Plane}
        statusLabel="Pendiente"
        statusVariant="pendiente"
        itemVariant="pending"
      />
    </div>
  );
}

export const Selectable: Story = { render: () => <SelectableList /> };
export const NotSelectable: Story = {};
export const Light: Story = {
  render: () => <SelectableList />,
  parameters: { themes: { themeOverride: 'light' } },
};
export const Dark: Story = {
  render: () => <SelectableList />,
  parameters: { themes: { themeOverride: 'dark' } },
};
