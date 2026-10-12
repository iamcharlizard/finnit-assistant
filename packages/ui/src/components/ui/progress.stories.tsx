import type { Meta, StoryObj } from '@storybook/react-vite';

import { Progress } from './progress';

const meta = {
  title: 'UI/Progress',
  component: Progress,
  args: { value: 62, 'aria-label': 'Presupuesto consumido' },
  argTypes: { value: { control: { type: 'range', min: 0, max: 100 } } },
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Progress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithGlow: Story = { args: { glow: true, className: 'h-2' } };
export const CustomColor: Story = {
  args: { indicatorColor: '#ffabf2', value: 45 },
};
