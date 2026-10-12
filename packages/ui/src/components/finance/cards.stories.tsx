import type { Meta, StoryObj } from '@storybook/react-vite';

import { BankPaymentCard } from './bank-payment-card';
import { CreditLimitCard } from './credit-limit-card';
import { ExpenseProjectionCard } from './expense-projection-card';
import { MonthlySpendingCard } from './monthly-spending-card';

const meta = {
  title: 'Finance/Cards',
  component: BankPaymentCard,
  args: {
    variant: 'platinum',
    cardTier: 'Platinum',
    bankName: 'Finnit Bank',
    maskedNumber: '**** **** **** 8824',
    holderName: 'ALEX NEUMANN',
    expiryDate: '12/28',
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['platinum', 'virtual', 'premium', 'stealth'],
    },
  },
} satisfies Meta<typeof BankPaymentCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Platinum: Story = {};
export const Virtual: Story = {
  args: { variant: 'virtual', cardTier: 'Virtual', balance: '$1,240.00' },
};
export const Premium: Story = {
  args: { variant: 'premium', cardTier: 'PREMIUM', bankName: undefined },
};
export const Stealth: Story = {
  args: {
    variant: 'stealth',
    cardTier: 'STEALTH BLACK',
    bankName: undefined,
    maskedNumber: '**** **** **** 4012',
    expiryDate: '05/26',
  },
};

export const CreditLimit: Story = {
  render: () => (
    <div className="max-w-sm">
      <CreditLimitCard used={12450} total={20000} />
    </div>
  ),
};

export const MonthlySpending: Story = {
  render: () => (
    <div className="max-w-sm">
      <MonthlySpendingCard amount="$4,280.40" trendLabel="12% vs anterior" />
    </div>
  ),
};

export const ExpenseProjection: Story = {
  render: () => (
    <div className="max-w-md">
      <ExpenseProjectionCard />
    </div>
  ),
};
