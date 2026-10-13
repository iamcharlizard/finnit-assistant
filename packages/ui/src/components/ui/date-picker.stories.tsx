import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { DatePicker, type DatePickerProps } from './date-picker';

function Controlled(props: DatePickerProps) {
  const [value, setValue] = React.useState(props.value);
  return (
    <div className="flex max-w-xs flex-col gap-2">
      <DatePicker {...props} value={value} onChange={setValue} />
      <p className="text-xs text-on-surface-variant">
        value: <code>{value ?? 'undefined'}</code>
      </p>
    </div>
  );
}

const meta = {
  title: 'UI/DatePicker',
  component: DatePicker,
  render: (args) => <Controlled {...args} />,
} satisfies Meta<typeof DatePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: { label: 'Due date', placeholder: 'Pick a date', locale: 'en' },
};
export const SpanishWithValue: Story = {
  args: {
    label: 'Fecha de pago',
    placeholder: 'Elige una fecha',
    locale: 'es',
    value: '2026-10-31',
  },
};
export const MinMax: Story = {
  args: {
    label: 'Fecha (1–20 oct)',
    locale: 'es',
    value: '2026-10-13',
    min: '2026-10-01',
    max: '2026-10-20',
  },
};
export const WithError: Story = {
  args: { label: 'Due date', error: 'Choose a date.', locale: 'en' },
};
export const Disabled: Story = {
  args: { label: 'Due date', value: '2026-10-13', disabled: true },
};
export const Light: Story = {
  args: { label: 'Fecha de pago', locale: 'es', value: '2026-01-01' },
  parameters: { themes: { themeOverride: 'light' } },
};
export const Dark: Story = {
  args: { label: 'Fecha de pago', locale: 'es', value: '2026-01-01' },
  parameters: { themes: { themeOverride: 'dark' } },
};
