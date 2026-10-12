import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { FilterChipGroup } from './filter-chip-group';

const ITEMS = [
  { value: 'all', label: 'Todos' },
  { value: 'income', label: 'Ingresos' },
  { value: 'expenses', label: 'Gastos' },
  { value: 'investment', label: 'Inversiones' },
];

const meta = {
  title: 'Finance/FilterChipGroup',
  component: FilterChipGroup,
  args: { items: ITEMS, activeValue: 'all', onSelect: () => {} },
} satisfies Meta<typeof FilterChipGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Interactive: Story = {
  render: function Render(args) {
    const [value, setValue] = React.useState(args.activeValue);
    return (
      <FilterChipGroup {...args} activeValue={value} onSelect={setValue} />
    );
  },
};

export const Period: Story = {
  args: {
    items: [
      { value: 'semana', label: 'Semana' },
      { value: 'mes', label: 'Mes' },
      { value: 'año', label: 'Año' },
    ],
    activeValue: 'mes',
    'aria-label': 'Periodo',
  },
};
