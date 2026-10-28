import type { Meta, StoryObj } from '@storybook/react-vite';

import { Textarea } from './textarea';

const meta = {
  title: 'UI/Textarea',
  component: Textarea,
  args: { placeholder: 'Add a note…' },
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { 'aria-label': 'Note' } };
export const WithLabelAndHint: Story = {
  args: { label: 'Notas', hint: 'Visible solo para ti.' },
};
export const WithError: Story = {
  args: {
    label: 'Notas',
    defaultValue: 'x',
    error: 'Escribe al menos 3 caracteres.',
  },
};
export const Disabled: Story = { args: { label: 'Notas', disabled: true } };
export const Light: Story = {
  args: { label: 'Notes', hint: 'Only visible to you.' },
  parameters: { themes: { themeOverride: 'light' } },
};
export const Dark: Story = {
  args: { label: 'Notes', hint: 'Only visible to you.' },
  parameters: { themes: { themeOverride: 'dark' } },
};
