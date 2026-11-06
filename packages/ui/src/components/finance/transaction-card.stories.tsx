import type { Meta, StoryObj } from '@storybook/react-vite';
import { ShoppingCart, Tag, Utensils } from 'lucide-react';
import * as React from 'react';

import { SuggestionChip } from './suggestion-chip';
import { TransactionCard } from './transaction-card';

const meta = {
  title: 'Finance/TransactionCard',
  component: TransactionCard,
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
  args: {
    onOpen: () => undefined,
    openLabel: 'Ver detalle',
  },
} satisfies Meta<typeof TransactionCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    merchant: 'Walmart Tonalá',
    category: 'Supermercado',
    time: 'Explora',
    amount: '-$325.00',
    icon: ShoppingCart,
    variant: 'expense',
    status: { label: 'Completado', variant: 'completado' },
  },
};

/** Uncategorized, with a pending suggestion inside the card. */
export const WithSuggestion: Story = {
  args: {
    merchant: 'WAL MART TONALANWM 9709244W4',
    category: 'Sin categoría',
    time: 'Explora',
    amount: '-$325.00',
    icon: Tag,
    variant: 'expense',
    selectable: true,
    footer: (
      <SuggestionChip
        text="Sugerencia: Supermercado"
        acceptLabel="Aceptar Supermercado"
        rejectLabel="Rechazar Supermercado"
        onAccept={() => undefined}
        onReject={() => undefined}
      />
    ),
  },
  render: (args) => {
    const [selected, setSelected] = React.useState(false);
    return (
      <TransactionCard
        {...args}
        selected={selected}
        onSelectedChange={setSelected}
      />
    );
  },
};

/** Hover the name: the pencil edits it right in the card (Enter saves, Esc cancels). */
export const EditableName: Story = {
  args: {
    merchant: 'WAL MART TONALANWM 9709244W4',
    category: 'Supermercado',
    time: '14:32',
    amount: '-$325.00',
    icon: ShoppingCart,
    variant: 'expense',
  },
  render: (args) => {
    const [name, setName] = React.useState(args.merchant);
    return (
      <TransactionCard
        {...args}
        merchant={name}
        rename={{
          editLabel: 'Editar nombre',
          inputLabel: 'Nombre del movimiento',
          maxLength: 80,
          onSave: async (next) => {
            await new Promise((resolve) => setTimeout(resolve, 400));
            setName(next || args.merchant);
          },
        }}
      />
    );
  },
};

export const PrivatePending: Story = {
  args: {
    merchant: 'Suscripción digital',
    category: 'Suscripciones',
    time: 'En proceso',
    amount: '-$150.00',
    icon: Utensils,
    variant: 'pending',
    isPrivate: true,
    privateLabel: 'Privado',
    status: { label: 'En proceso', variant: 'info' },
  },
};
