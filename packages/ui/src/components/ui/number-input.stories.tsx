import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { NumberInput, type NumberInputProps } from './number-input';

/** Keeps the value in state and shows it, as a form would store it. */
function Controlled({
  initial = '',
  ...props
}: Omit<NumberInputProps, 'value' | 'onValueChange'> & { initial?: string }) {
  const [value, setValue] = React.useState(initial);
  return (
    <div className="flex flex-col gap-2">
      <NumberInput {...props} value={value} onValueChange={setValue} />
      <p className="px-1 text-xs text-on-surface-variant">
        Valor guardado: <code>{JSON.stringify(value)}</code>
      </p>
    </div>
  );
}

const meta = {
  title: 'UI/Number input',
  component: NumberInput,
  parameters: {
    docs: {
      description: {
        component: `
Campo para números que no son dinero (tasas, número de pagos, días del mes,
prioridades). Nunca deja entrar letras ni símbolos.

- **Enteros** por omisión. Con \`decimals\` acepta un punto decimal (la coma
  también cuenta como punto) y hasta esos dígitos después.
- \`allowNegative\` permite un "-" al inicio; \`maxDigits\` limita los dígitos
  de la parte entera (p. ej. 2 para un día del mes).
- \`suffix\` muestra una unidad al final, como \`%\`.
- El valor es el número como texto (\`"45.5"\`), listo para validar.

Para montos de dinero usa **MoneyInput**.
        `,
      },
    },
  },
  args: { value: '', onValueChange: () => undefined },
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof NumberInput>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A whole number: letters, points and signs are dropped. */
export const WholeNumber: Story = {
  render: () => (
    <Controlled label="Número de pagos" placeholder="Ej. 12" initial="12" />
  ),
};

export const Rate: Story = {
  render: () => (
    <Controlled
      label="Tasa de interés ordinaria anual"
      decimals={4}
      suffix="%"
      placeholder="Ej. 45"
      initial="45.5"
    />
  ),
};

export const DayOfMonth: Story = {
  render: () => (
    <Controlled label="Día de corte" maxDigits={2} placeholder="1–31" />
  ),
};

export const Negative: Story = {
  render: () => (
    <Controlled label="Prioridad" allowNegative maxDigits={4} initial="-10" />
  ),
};

export const WithError: Story = {
  render: () => (
    <Controlled
      label="Pagos ya hechos"
      initial="13"
      error="No puedes llevar más pagos de los que tiene el préstamo."
    />
  ),
};
