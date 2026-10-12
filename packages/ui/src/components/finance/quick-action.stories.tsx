import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Ellipsis,
  Film,
  Heart,
  Plane,
  ShoppingBag,
  Utensils,
} from 'lucide-react';

import { QuickAction } from './quick-action';

const meta = {
  title: 'Finance/QuickAction',
  component: QuickAction,
  args: { label: 'Compras', icon: ShoppingBag },
} satisfies Meta<typeof QuickAction>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Grid: Story = {
  render: () => (
    <div className="grid max-w-sm grid-cols-3 gap-4">
      {[
        { label: 'Compras', icon: ShoppingBag },
        { label: 'Comida', icon: Utensils },
        { label: 'Viajes', icon: Plane },
        { label: 'Ocio', icon: Film },
        { label: 'Salud', icon: Heart },
        { label: 'Más', icon: Ellipsis },
      ].map((c) => (
        <QuickAction key={c.label} {...c} />
      ))}
    </div>
  ),
};
