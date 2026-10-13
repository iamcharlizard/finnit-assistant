import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Bus,
  Car,
  Coffee,
  Home,
  ShoppingCart,
  Utensils,
  Zap,
} from 'lucide-react';

import { Combobox, type ComboboxOption, type ComboboxProps } from './combobox';

const CATEGORIES: ComboboxOption[] = [
  {
    value: 'groceries',
    label: 'Supermercado',
    group: 'Alimentos',
    icon: ShoppingCart,
  },
  {
    value: 'restaurants',
    label: 'Restaurantes',
    group: 'Alimentos',
    icon: Utensils,
  },
  {
    value: 'coffee',
    label: 'Café',
    group: 'Alimentos',
    icon: Coffee,
    keywords: ['starbucks'],
  },
  { value: 'rent', label: 'Renta', group: 'Hogar', icon: Home },
  {
    value: 'power',
    label: 'Luz',
    group: 'Hogar',
    icon: Zap,
    keywords: ['cfe'],
  },
  { value: 'fuel', label: 'Gasolina', group: 'Transporte', icon: Car },
  {
    value: 'transit',
    label: 'Transporte público',
    group: 'Transporte',
    icon: Bus,
    disabled: true,
  },
];

function Controlled(props: ComboboxProps) {
  const [value, setValue] = React.useState(props.value);
  return (
    <div className="flex max-w-xs flex-col gap-2">
      <Combobox {...props} value={value} onChange={setValue} />
      <p className="text-xs text-on-surface-variant">
        value: <code>{value ?? 'undefined'}</code>
      </p>
    </div>
  );
}

const meta = {
  title: 'UI/Combobox',
  component: Combobox,
  render: (args) => <Controlled {...args} />,
  args: {
    options: CATEGORIES,
    label: 'Categoría',
    placeholder: 'Elige una categoría',
    searchPlaceholder: 'Buscar categoría…',
    emptyText: 'Sin resultados.',
  },
} satisfies Meta<typeof Combobox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Grouped: Story = {};
export const WithValue: Story = { args: { value: 'coffee', clearable: true } };
export const Ungrouped: Story = {
  args: {
    label: 'Account',
    placeholder: 'Select an account',
    searchPlaceholder: 'Search…',
    emptyText: 'No results.',
    options: [
      { value: 'bbva', label: 'BBVA Débito' },
      { value: 'nu', label: 'Nu Crédito' },
      { value: 'cash', label: 'Efectivo' },
    ],
  },
};
export const WithError: Story = { args: { error: 'Elige una categoría.' } };
export const Disabled: Story = { args: { value: 'rent', disabled: true } };
export const Light: Story = {
  args: { value: 'groceries' },
  parameters: { themes: { themeOverride: 'light' } },
};
export const Dark: Story = {
  args: { value: 'groceries' },
  parameters: { themes: { themeOverride: 'dark' } },
};
