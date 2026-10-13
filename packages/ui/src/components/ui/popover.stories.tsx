import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from './button';
import { Input } from './input';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

const meta = {
  title: 'UI/Popover',
  component: Popover,
} satisfies Meta<typeof Popover>;

export default meta;
type Story = StoryObj<typeof meta>;

const Example = ({ open }: { open?: boolean }) => (
  <Popover defaultOpen={open}>
    <PopoverTrigger asChild>
      <Button variant="outline" label="Editar límite" />
    </PopoverTrigger>
    <PopoverContent align="start" className="flex flex-col gap-3">
      <p className="text-sm font-bold text-on-background">Límite mensual</p>
      <Input label="Monto" defaultValue="$4,000" />
    </PopoverContent>
  </Popover>
);

export const Default: Story = { render: () => <Example /> };
export const OpenLight: Story = {
  render: () => <Example open />,
  parameters: { themes: { themeOverride: 'light' } },
};
export const OpenDark: Story = {
  render: () => <Example open />,
  parameters: { themes: { themeOverride: 'dark' } },
};
