import type { Meta, StoryObj } from '@storybook/react-vite';

import { Badge } from './badge';

const meta = {
  title: 'UI/Badge',
  component: Badge,
  args: { children: 'Pendiente' },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="default">Default</Badge>
      <Badge variant="brand">Pendiente</Badge>
      <Badge variant="muted">Programado</Badge>
      <Badge variant="success">Pagado</Badge>
      <Badge variant="income">Ingreso</Badge>
      <Badge variant="expense">Gasto</Badge>
      <Badge variant="highlight">Premium</Badge>
      <Badge variant="outline">Outline</Badge>
    </div>
  ),
};
