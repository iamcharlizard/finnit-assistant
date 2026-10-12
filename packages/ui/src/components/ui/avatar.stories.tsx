import type { Meta, StoryObj } from '@storybook/react-vite';

import { Avatar, AvatarFallback, AvatarImage } from './avatar';

const meta = {
  title: 'UI/Avatar',
  component: Avatar,
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Fallback: Story = {
  render: () => (
    <Avatar className="size-12 border-2 border-primary">
      <AvatarFallback>AN</AvatarFallback>
    </Avatar>
  ),
};

export const BrokenImage: Story = {
  render: () => (
    <Avatar className="size-12">
      <AvatarImage src="/does-not-exist.png" alt="Alex Neumann" />
      <AvatarFallback>AN</AvatarFallback>
    </Avatar>
  ),
};
