import type { Meta, StoryObj } from '@storybook/react-vite';

import { CategoryDonut } from './category-donut';

const meta = {
  title: 'Finance/CategoryDonut',
  component: CategoryDonut,
  decorators: [
    (Story) => (
      <div className="max-w-xs rounded-card bg-surface p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CategoryDonut>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Spending: Story = {
  args: {
    totalLabel: 'Gastado',
    total: '$18,420.00',
    summary: 'Gasto del mes por categoría',
    slices: [
      {
        id: 'food',
        label: 'Comida',
        percent: 34,
        amount: '$6,262.80',
        percentage: '34%',
        color: '#f59e0b',
      },
      {
        id: 'transport',
        label: 'Transporte',
        percent: 22,
        amount: '$4,052.40',
        percentage: '22%',
        color: '#3b82f6',
      },
      {
        id: 'bills',
        label: 'Servicios',
        percent: 18,
        amount: '$3,315.60',
        percentage: '18%',
        color: '#6c72cb',
      },
      {
        id: 'shopping',
        label: 'Compras',
        percent: 12,
        amount: '$2,210.40',
        percentage: '12%',
        color: '#ec4899',
      },
      {
        id: 'health',
        label: 'Salud',
        percent: 8,
        amount: '$1,473.60',
        percentage: '8%',
        color: '#ef4444',
      },
      {
        id: 'others',
        label: 'Otras categorías',
        percent: 6,
        amount: '$1,105.20',
        percentage: '6%',
        color: 'var(--outline)',
      },
    ],
  },
};

export const OneCategory: Story = {
  args: {
    ...Spending.args,
    slices: [
      {
        id: 'food',
        label: 'Comida',
        percent: 100,
        amount: '$900.00',
        percentage: '100%',
        color: '#f59e0b',
      },
    ],
  } as Story['args'],
};
