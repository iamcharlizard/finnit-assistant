import type { Meta, StoryObj } from '@storybook/react-vite';

import { StatCard } from './stat-card';

const meta = {
  title: 'Finance/StatCard',
  component: StatCard,
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StatCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Income: Story = {
  args: { variant: 'income', label: 'Ingresos Mensuales', amount: '$8,240.00' },
};
export const Expense: Story = {
  args: { variant: 'expense', label: 'Gastos Mensuales', amount: '$3,960.00' },
};
