import type { Meta, StoryObj } from '@storybook/react-vite';
import { CreditCard, Receipt, Settings, Wallet } from 'lucide-react';

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from './command';

const meta = {
  title: 'UI/Command',
  component: Command,
} satisfies Meta<typeof Command>;

export default meta;
type Story = StoryObj<typeof meta>;

const Example = () => (
  <Command
    label="Command menu"
    className="max-w-sm border border-glass-border shadow-lg"
  >
    <CommandInput placeholder="Search…" />
    <CommandList>
      <CommandEmpty>No results.</CommandEmpty>
      <CommandGroup heading="Go to">
        <CommandItem>
          <Wallet /> Accounts
        </CommandItem>
        <CommandItem>
          <CreditCard /> Cards
        </CommandItem>
        <CommandItem disabled>
          <Receipt /> Statements
        </CommandItem>
      </CommandGroup>
      <CommandSeparator />
      <CommandGroup heading="Settings">
        <CommandItem>
          <Settings /> Preferences <CommandShortcut>⌘,</CommandShortcut>
        </CommandItem>
      </CommandGroup>
    </CommandList>
  </Command>
);

export const Default: Story = { render: () => <Example /> };
export const Light: Story = {
  render: () => <Example />,
  parameters: { themes: { themeOverride: 'light' } },
};
export const Dark: Story = {
  render: () => <Example />,
  parameters: { themes: { themeOverride: 'dark' } },
};
