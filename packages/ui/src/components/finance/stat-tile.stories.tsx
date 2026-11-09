import type { Meta, StoryObj } from '@storybook/react-vite';
import { ArrowLeftRight, CalendarClock, Download, Wallet } from 'lucide-react';

import { StatTile } from './stat-tile';

const meta = {
  title: 'Finance/StatTile',
  component: StatTile,
  decorators: [
    (Story) => (
      <div className="max-w-xs">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StatTile>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Balance: Story = {
  args: {
    icon: Wallet,
    color: 'var(--chart-1)',
    label: 'Saldo total',
    value: '$2,480.75',
    trend: { label: '+12.5%', direction: 'up', tone: 'positive' },
    compareLabel: 'vs hace 30 días',
    spark: [1800, 1900, 1850, 2100, 2050, 2300, 2480],
  },
};

export const SpendingUp: Story = {
  args: {
    icon: ArrowLeftRight,
    color: 'var(--chart-2)',
    label: 'Gastos del mes',
    value: '$980.00',
    trend: { label: '+8.3%', direction: 'up', tone: 'negative' },
    compareLabel: 'vs mes anterior',
    spark: [100, 180, 260, 420, 600, 760, 980],
  },
};

export const Income: Story = {
  args: {
    icon: Download,
    color: 'var(--chart-3)',
    label: 'Ingresos del mes',
    value: '$1,250.75',
    trend: { label: '+15.2%', direction: 'up', tone: 'positive' },
    compareLabel: 'vs mes anterior',
    spark: [0, 0, 600, 600, 600, 1250, 1250],
  },
};

export const Pending: Story = {
  args: {
    icon: CalendarClock,
    color: 'var(--chart-4)',
    label: 'Pagos pendientes',
    value: '$220.00',
    caption: '2 próximos',
  },
};
