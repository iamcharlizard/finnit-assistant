import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { Calendar } from './calendar';

const meta = {
  title: 'UI/Calendar',
  component: Calendar,
} satisfies Meta<typeof Calendar>;

export default meta;
type Story = StoryObj<typeof meta>;

function SingleExample({ locale }: { locale: 'es' | 'en' }) {
  const [selected, setSelected] = React.useState<Date | undefined>(
    new Date(2026, 9, 13),
  );
  return (
    <Calendar
      mode="single"
      locale={locale}
      selected={selected}
      onSelect={setSelected}
      defaultMonth={new Date(2026, 9, 1)}
      disabled={{ before: new Date(2026, 9, 5) }}
      className="rounded-card border border-glass-border bg-surface"
    />
  );
}

export const English: Story = { render: () => <SingleExample locale="en" /> };
export const Spanish: Story = { render: () => <SingleExample locale="es" /> };
export const Light: Story = {
  render: () => <SingleExample locale="es" />,
  parameters: { themes: { themeOverride: 'light' } },
};
export const Dark: Story = {
  render: () => <SingleExample locale="es" />,
  parameters: { themes: { themeOverride: 'dark' } },
};
