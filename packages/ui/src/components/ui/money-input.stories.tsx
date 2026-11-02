import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { MONEY_FORMATS, type MoneyCountry } from '../../lib/money-format';
import { MoneyFormatProvider, MoneyInput, type MoneyInputProps } from './money-input';

/** Keeps the raw value in state and shows it, as a form would store it. */
function Controlled(props: Omit<MoneyInputProps, 'value' | 'onValueChange'> & {
  initial?: string;
}) {
  const { initial = '', ...rest } = props;
  const [value, setValue] = React.useState(initial);
  return (
    <div className="flex flex-col gap-2">
      <MoneyInput {...rest} value={value} onValueChange={setValue} />
      <p className="px-1 text-xs text-on-surface-variant">
        Valor guardado: <code>{JSON.stringify(value)}</code>
      </p>
    </div>
  );
}

const meta = {
  title: 'UI/Money input',
  component: MoneyInput,
  parameters: {
    docs: {
      description: {
        component: `
Campo para montos de dinero. Solo acepta números y un separador decimal, y
muestra el monto con el formato del país mientras escribes.

- **México (por omisión):** \`$\` y \`MXN\`, coma para millares, apóstrofo para
  millones y punto para centavos: \`$ 1'250,000.50 MXN\`.
- **El valor que recibe y entrega siempre es crudo** (\`"1250000.50"\`: dígitos y
  punto decimal), sin importar el país, así los formularios lo leen igual.
- Al salir del campo completa los centavos (\`1200\` → \`1,200.00\`).
- Si borras justo sobre un separador, se borra el dígito de al lado.

**Formato por país.** Envuelve la app (o una parte) en
\`<MoneyFormatProvider country="CO">\`, o pasa \`format\` a un campo. Los
formatos disponibles están en \`MONEY_FORMATS\` (\`lib/money-format.ts\`):
${Object.keys(MONEY_FORMATS).join(', ')}. Para otro país agrega su entrada ahí
(moneda, símbolo y su posición, separadores y decimales). Con \`currency\` se
cambia solo la moneda (p. ej. una cuenta en USD con el formato de México).

Para un campo con diseño propio usa el hook \`useMoneyMask\`.
        `,
      },
    },
  },
  args: { value: '', onValueChange: () => undefined, label: 'Monto prestado' },
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MoneyInput>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Mexico: "$ 200,000.00 MXN"; millions with an apostrophe. */
export const Default: Story = {
  render: (args) => <Controlled label={args.label} initial="200000" />,
};

export const Millions: Story = {
  render: () => <Controlled label="Monto prestado" initial="1250000.5" />,
};

export const Empty: Story = {
  render: () => <Controlled label="Pago mínimo" />,
};

export const WithError: Story = {
  render: () => (
    <Controlled
      label="Comisión por apertura"
      initial="250000"
      error="La comisión debe ser menor al monto prestado."
    />
  ),
};

export const Disabled: Story = {
  render: () => (
    <Controlled label="Monto depositado" initial="18840" disabled />
  ),
};

/** An account in another currency keeps the country's separators. */
export const OtherCurrency: Story = {
  render: () => (
    <Controlled label="Saldo de la cuenta" initial="3500.75" currency="USD" />
  ),
};

export const WithoutCurrencyCode: Story = {
  render: () => (
    <Controlled label="Pago extra al mes" initial="500" showCurrency={false} />
  ),
};

/** The same amount in each available country format. */
export const Countries: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {(Object.keys(MONEY_FORMATS) as MoneyCountry[]).map((country) => (
        <Controlled
          key={country}
          label={country}
          format={country}
          initial="1250000.5"
        />
      ))}
    </div>
  ),
};

/** Every field inside takes the provider's country. */
export const WithProvider: Story = {
  render: () => (
    <MoneyFormatProvider country="CO">
      <div className="flex flex-col gap-4">
        <Controlled label="Monto (Colombia)" initial="1250000.5" />
        <Controlled label="Cuota" initial="85000" />
      </div>
    </MoneyFormatProvider>
  ),
};
