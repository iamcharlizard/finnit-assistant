import type { Meta, StoryObj } from '@storybook/react-vite';

import { NeoTipCard } from './neo-tip-card';

const meta = {
  title: 'Finance/NeoTipCard',
  component: NeoTipCard,
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof NeoTipCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithHighlight: Story = {
  args: {
    title: 'Optimización de Suscripciones',
    body: 'Detectamos 3 suscripciones que no has usado en los últimos 30 días. Podrías ahorrar ',
    highlight: '$45.00/mes',
    bodyAfterHighlight: ' cancelándolas.',
    actionLabel: 'Optimizar ahora',
  },
};

export const WithoutAction: Story = {
  args: {
    title: 'Consejo Finnit AI',
    body: 'Tus suscripciones digitales subieron un 12%. Podrías ahorrar $15/mes cancelando servicios que no usas.',
  },
};
