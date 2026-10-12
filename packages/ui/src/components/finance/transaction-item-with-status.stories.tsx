import type { Meta, StoryObj } from '@storybook/react-vite';
import { Banknote, ShoppingCart, TriangleAlert, Utensils } from 'lucide-react';

import { TransactionItemWithStatus } from './transaction-item-with-status';

const meta = {
  title: 'Finance/TransactionItemWithStatus',
  component: TransactionItemWithStatus,
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TransactionItemWithStatus>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Completed: Story = {
  args: {
    merchant: 'Apple Store',
    category: 'Electrónica',
    time: '14:32',
    amount: '-$1,299.00',
    statusLabel: 'Completado',
    statusVariant: 'completado',
    itemVariant: 'expense',
    icon: ShoppingCart,
  },
};

export const Info: Story = {
  args: {
    merchant: 'Transferencia Recibida',
    category: 'De: Marcos Soler',
    time: '10:15',
    amount: '+$450.00',
    statusLabel: 'Vía SPEI',
    statusVariant: 'info',
    itemVariant: 'income',
    icon: Banknote,
  },
};

export const Pending: Story = {
  args: {
    merchant: 'Sushi Zen Master',
    category: 'Restaurantes',
    time: '21:05',
    amount: '-$84.20',
    statusLabel: 'Pendiente',
    statusVariant: 'pendiente',
    itemVariant: 'pending',
    icon: Utensils,
  },
};

export const Failed: Story = {
  args: {
    merchant: 'Suscripción Netflix',
    category: 'Entretenimiento',
    time: '04:00',
    amount: '-$15.99',
    statusLabel: 'Fallida',
    statusVariant: 'fallida',
    itemVariant: 'failed',
    icon: TriangleAlert,
  },
};
