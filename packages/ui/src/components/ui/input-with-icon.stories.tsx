import type { Meta, StoryObj } from '@storybook/react-vite';
import { AtSign, Eye, Lock, Search } from 'lucide-react';

import { InputWithIcon } from './input-with-icon';

const meta = {
  title: 'UI/InputWithIcon',
  component: InputWithIcon,
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InputWithIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Email: Story = {
  args: {
    label: 'Correo electrónico',
    iconLeft: AtSign,
    placeholder: 'nombre@ejemplo.com',
    type: 'email',
  },
};

export const Password: Story = {
  args: {
    label: 'Contraseña',
    iconLeft: Lock,
    iconRight: Eye,
    iconRightAccessibilityLabel: 'Mostrar contraseña',
    type: 'password',
    placeholder: '••••••••',
  },
};

export const SearchField: Story = {
  args: {
    iconLeft: Search,
    placeholder: 'Buscar transacción, comercio...',
    'aria-label': 'Buscar transacciones',
  },
};

export const WithError: Story = {
  args: {
    label: 'Correo electrónico',
    iconLeft: AtSign,
    defaultValue: 'correo@',
    error: 'Ingresa un correo válido.',
  },
};
