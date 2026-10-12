import type { Meta, StoryObj } from '@storybook/react-vite';

import { BalanceCard } from './balance-card';
import { BalanceCardRoot } from './balance-card-root';
import { SparklineChart } from './sparkline-chart';

const meta = {
  title: 'Finance/BalanceCard',
  component: BalanceCardRoot,
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BalanceCardRoot>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <BalanceCard.Root>
      <BalanceCard.Header amount="$45,280.00" trend="+2.4%" trendPositive />
      <BalanceCard.Chart>
        <SparklineChart />
      </BalanceCard.Chart>
    </BalanceCard.Root>
  ),
};

export const NegativeTrend: Story = {
  render: () => (
    <BalanceCard.Root>
      <BalanceCard.Header
        amount="$12,904.18"
        trend="-3.1%"
        trendPositive={false}
      />
      <BalanceCard.Chart>
        <SparklineChart path="M0,10 Q50,20 100,15 T200,40 T300,50 T400,70" />
      </BalanceCard.Chart>
      <BalanceCard.Footer>
        <span className="text-sm text-on-surface-variant">
          Actualizado hace 2 min
        </span>
      </BalanceCard.Footer>
    </BalanceCard.Root>
  ),
};
