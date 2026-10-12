import type { Meta, StoryObj } from '@storybook/react-vite';
import { Plane, ShoppingBag, Utensils, Zap } from 'lucide-react';

import { CategoryChip } from './category-chip';
import { CategoryProgressItem } from './category-progress-item';
import { PopularCategoriesCard } from './popular-categories-card';
import { SpendingCategoryCard } from './spending-category-card';

const meta = {
  title: 'Finance/Categories',
  component: CategoryProgressItem,
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CategoryProgressItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ProgressItem: Story = {
  args: {
    label: 'Compras',
    amount: '$1,250',
    progressPercent: 65,
    icon: ShoppingBag,
    accentColor: '#ffabf2',
  },
};

export const ProgressList: Story = {
  args: ProgressItem.args as Story['args'],
  render: () => (
    <div className="flex flex-col gap-2">
      <CategoryProgressItem
        label="Compras"
        amount="$1,250"
        progressPercent={65}
        icon={ShoppingBag}
        accentColor="#ffabf2"
      />
      <CategoryProgressItem
        label="Restaurantes"
        amount="$840"
        progressPercent={45}
        icon={Utensils}
        accentColor="#6c72cb"
      />
    </div>
  ),
};

export const SpendingCards: Story = {
  args: ProgressItem.args as Story['args'],
  render: () => (
    <div className="flex gap-3">
      <SpendingCategoryCard
        label="Viajes"
        amount="$540.20"
        percent={32}
        icon={Plane}
        accentColor="#6c72cb"
      />
      <SpendingCategoryCard
        label="Servicios"
        amount="$210.00"
        percent={14}
        icon={Zap}
        accentColor="#27dec1"
      />
    </div>
  ),
};

export const Chips: Story = {
  args: ProgressItem.args as Story['args'],
  render: () => (
    <div className="flex gap-3">
      <CategoryChip label="Comida" icon={Utensils} accentColor="#27dec1" />
      <CategoryChip label="Viajes" icon={Plane} accentColor="#6c72cb" />
      <CategoryChip label="Compras" icon={ShoppingBag} accentColor="#ffabf2" />
    </div>
  ),
};

export const Popular: Story = {
  args: ProgressItem.args as Story['args'],
  render: () => (
    <PopularCategoriesCard
      categories={[
        {
          id: 'tech',
          label: 'Tecnología',
          percentage: '45%',
          dotColor: '#00f5ff',
        },
        {
          id: 'food',
          label: 'Alimentación',
          percentage: '22%',
          dotColor: '#6c72cb',
        },
        {
          id: 'leisure',
          label: 'Ocio',
          percentage: '18%',
          dotColor: '#ffaedd',
        },
      ]}
    />
  ),
};
