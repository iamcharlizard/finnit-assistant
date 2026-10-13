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

export const CustomColorLight: Story = {
  args: { primaryColor: '#E8590C', cardTier: 'Oro', bankName: 'Banco Naranja' },
  parameters: { themes: { themeOverride: 'light' } },
};
export const CustomColorDark: Story = {
  args: { primaryColor: '#0B3D91', cardTier: 'Débito', bankName: 'Azul Bank' },
  parameters: { themes: { themeOverride: 'dark' } },
};
export const CustomGradient: Story = {
  args: {
    primaryColor: '#5B61C2',
    secondaryColor: '#AD009B',
    cardTier: 'Signature',
    bankName: 'Finnit Bank',
  },
};
export const CustomGradientLightStops: Story = {
  args: {
    primaryColor: '#00F5FF',
    secondaryColor: '#F2F2F2',
    cardTier: 'Virtual',
    bankName: 'Cyan Bank',
    balance: '$1,240.00',
  },
};
/** Stops of very different luminance: neither text color passes on both, the best worst-case wins. */
export const LowContrastGradient: Story = {
  args: {
    primaryColor: '#111111',
    secondaryColor: '#FFD600',
    cardTier: 'Edge case',
    bankName: 'Contrast Bank',
  },
};
export const CustomColorGallery: Story = {
  render: (args) => (
    <div className="grid gap-4 md:grid-cols-2">
      {[
        ['#F2B600', undefined],
        ['#2B8A3E', undefined],
        ['#BA1A1A', '#E8590C'],
        ['#FFFFFF', '#00F5FF'],
      ].map(([primary, secondary]) => (
        <BankPaymentCard
          key={`${primary}-${secondary}`}
          {...args}
          primaryColor={primary}
          secondaryColor={secondary}
          cardTier={secondary ? `${primary} → ${secondary}` : primary!}
        />
      ))}
    </div>
  ),
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
