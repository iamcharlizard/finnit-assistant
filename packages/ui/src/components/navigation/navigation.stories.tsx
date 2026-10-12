import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChartLine, CreditCard, House, Settings } from 'lucide-react';

import { BottomNavBar } from './bottom-nav-bar';
import type { NavItem } from './nav-types';
import { SideNav } from './side-nav';
import { TopAppBar } from './top-app-bar';

const ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Home', icon: House },
  { href: '/analytics', label: 'Analytics', icon: ChartLine },
  { href: '/cards', label: 'Cards', icon: CreditCard },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const meta = {
  title: 'Navigation/TopAppBar',
  component: TopAppBar,
  parameters: { layout: 'fullscreen' },
  args: { title: 'Finnit', notificationCount: 2, avatarFallback: 'AN' },
} satisfies Meta<typeof TopAppBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AppBar: Story = {};
export const AppBarNoNotifications: Story = {
  args: { notificationCount: 0, title: 'Finnit Analytics' },
};

export const BottomBar: Story = {
  render: () => (
    <div className="relative h-40">
      <BottomNavBar
        items={ITEMS}
        activeHref="/dashboard"
        className="absolute"
      />
    </div>
  ),
};

export const Sidebar: Story = {
  render: () => (
    <div className="h-[560px]">
      <SideNav items={ITEMS} activeHref="/analytics" />
    </div>
  ),
};
