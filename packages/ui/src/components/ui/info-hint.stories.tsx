import type { Meta, StoryObj } from '@storybook/react-vite';

import { InfoHint } from './info-hint';

const meta = {
  title: 'UI/Info hint',
  component: InfoHint,
  parameters: {
    docs: {
      description: {
        component:
          'Ícono de información con texto de ayuda. Se abre al pasar el cursor y al dar clic o tocar (funciona en celular y con teclado). Úsalo en lugar de párrafos de ayuda siempre visibles.',
      },
    },
  },
  args: {
    label: 'Más sobre liquidarlo hoy',
    children:
      'Capital pendiente, sin intereses, IVA ni comisiones futuras. Confirma el monto exacto con la institución.',
  },
  decorators: [
    (Story) => (
      <div className="flex items-center gap-1 p-16 text-sm text-on-surface-variant">
        Para liquidarlo hoy
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InfoHint>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
