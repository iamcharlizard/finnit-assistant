import type { Meta, StoryObj } from '@storybook/react-vite';

import { AnalyticsHeroCard } from './analytics-hero-card';
import { DonutRing } from './donut-ring';
import { FinancialHealthChart } from './financial-health-chart';
import { MonthlyDistributionChart } from './monthly-distribution-chart';

const meta = {
  title: 'Finance/Analytics',
  component: AnalyticsHeroCard,
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AnalyticsHeroCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const HeroCard: Story = {
  args: {
    label: 'Gasto Total',
    amount: '$4,820.50',
    trendPercent: '12%',
    trendDown: true,
  },
};

export const HeroCardTrendUp: Story = {
  args: {
    label: 'Ingreso Total',
    amount: '$9,120.00',
    trendPercent: '8%',
    trendDown: false,
  },
};

export const HealthChart: Story = {
  args: { amount: '', trendPercent: '' },
  render: () => <FinancialHealthChart percentage={75} />,
};

export const HealthChartLow: Story = {
  args: { amount: '', trendPercent: '' },
  render: () => (
    <FinancialHealthChart
      percentage={32}
      rating="Atención"
      caption="Tus gastos superaron tus ingresos dos meses seguidos."
    />
  ),
};

export const Donut: Story = {
  args: { amount: '', trendPercent: '' },
  render: () => (
    <div className="flex gap-6">
      {[10, 50, 75, 100].map((p) => (
        <DonutRing key={p} percentage={p} size={96} strokeWidth={10} />
      ))}
    </div>
  ),
};

export const MonthlyDistribution: Story = {
  args: { amount: '', trendPercent: '' },
  render: () => <MonthlyDistributionChart />,
};
