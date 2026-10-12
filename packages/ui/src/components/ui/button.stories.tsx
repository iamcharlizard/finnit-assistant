import type { Meta, StoryObj } from '@storybook/react-vite';
import { ArrowRight } from 'lucide-react';

import { Button } from './button';

const meta = {
  title: 'UI/Button',
  component: Button,
  args: { label: 'Iniciar sesión' },
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'primary',
        'secondary',
        'ghost',
        'outline',
        'destructive',
        'link',
      ],
    },
    size: { control: 'select', options: ['default', 'sm', 'lg', 'icon'] },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = { args: { variant: 'primary' } };
export const Secondary: Story = { args: { variant: 'secondary' } };
export const Ghost: Story = { args: { variant: 'ghost' } };
export const Outline: Story = { args: { variant: 'outline' } };
export const Destructive: Story = {
  args: { variant: 'destructive', label: 'Cerrar sesión' },
};

export const WithIcon: Story = {
  args: { label: undefined, size: 'lg' },
  render: (args) => (
    <Button {...args}>
      Continuar <ArrowRight />
    </Button>
  ),
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      {(
        [
          'primary',
          'secondary',
          'ghost',
          'outline',
          'destructive',
          'link',
        ] as const
      ).map((variant) => (
        <Button key={variant} variant={variant} label={variant} />
      ))}
    </div>
  ),
};
