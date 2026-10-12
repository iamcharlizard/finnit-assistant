import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  ArrowDown,
  BriefcaseMedical,
  ChartLine,
  House,
  Landmark,
  Zap,
} from 'lucide-react';

import { Progress } from '../ui/progress';
import { AddPaymentCta } from './add-payment-cta';
import { MonthlyBudgetCard } from './monthly-budget-card';
import { PaymentCalendar } from './payment-calendar';
import { PaymentItem } from './payment-item';
import { ProjectionCard } from './projection-card';

const meta = {
  title: 'Finance/Payments',
  component: PaymentItem,
  args: {
    title: 'Alquiler Octubre',
    amount: '$850.00',
    status: 'pending',
    timeLabel: 'Hace 2 días',
    icon: House,
    iconBg: '#00696e',
  },
  argTypes: {
    status: { control: 'select', options: ['pending', 'scheduled', 'paid'] },
  },
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PaymentItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Pending: Story = {};
export const Scheduled: Story = {
  args: {
    title: 'Seguro Médico',
    amount: '$120.00',
    status: 'scheduled',
    timeLabel: 'En 3 días',
    icon: BriefcaseMedical,
    iconBg: '#6c72cb',
  },
};
export const Paid: Story = {
  args: {
    title: 'Servicio Eléctrico',
    amount: '$45.50',
    status: 'paid',
    timeLabel: 'Ayer',
    icon: Zap,
    iconBg: 'rgba(0,0,0,0.08)',
    iconTint: '#5c6370',
  },
};

export const Calendar: Story = {
  render: function Render() {
    const [selected, setSelected] = React.useState<number | null>(null);
    const [mode, setMode] = React.useState<'month' | 'week'>('month');
    return (
      <PaymentCalendar
        monthLabel="Octubre 2026"
        leadingDays={[28, 29, 30]}
        daysInMonth={31}
        today={12}
        events={{
          3: { label: 'Alquiler', accent: 'primary' },
          10: { label: 'Seguro', accent: 'neon' },
        }}
        selectedDay={selected}
        onSelectDay={setSelected}
        viewMode={mode}
        onViewModeChange={setMode}
      />
    );
  },
};

export const Projections: Story = {
  render: () => (
    <div className="flex gap-2.5">
      <ProjectionCard
        label="Ahorro proyectado"
        amount="$2,450.00"
        icon={ChartLine}
        accentColor="#00696e"
      >
        <Progress
          value={75}
          glow
          indicatorColor="#00696e"
          className="mb-1.5"
          aria-label="75% de tu meta mensual"
        />
        <p className="text-[10px] text-on-surface-variant">
          75% de tu meta mensual
        </p>
      </ProjectionCard>
      <ProjectionCard
        label="Gastos fijos"
        amount="$1,120.40"
        icon={Landmark}
        accentColor="#6c72cb"
      >
        <p className="flex items-center gap-1 text-[10px] text-on-surface-variant">
          <ArrowDown aria-hidden className="size-3 text-green-500" />
          5% menos que el mes pasado
        </p>
      </ProjectionCard>
    </div>
  ),
};

export const AddPayment: Story = { render: () => <AddPaymentCta /> };

export const MonthlyBudget: Story = {
  render: () => (
    <MonthlyBudgetCard amount="$2,480" cents=".50" usedPercent={75} />
  ),
};
