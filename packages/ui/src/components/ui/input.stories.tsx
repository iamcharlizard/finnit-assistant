import type { Meta, StoryObj } from '@storybook/react-vite';

import { Input } from './input';

const meta = {
  title: 'UI/Input',
  component: Input,
  args: { placeholder: 'nombre@ejemplo.com' },
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { 'aria-label': 'Correo electrónico' } };
export const WithLabel: Story = { args: { label: 'Correo electrónico' } };
export const WithError: Story = {
  args: {
    label: 'Correo electrónico',
    defaultValue: 'correo-invalido',
    error: 'Ingresa un correo válido.',
  },
};
export const Disabled: Story = {
  args: { label: 'Correo electrónico', disabled: true },
};
