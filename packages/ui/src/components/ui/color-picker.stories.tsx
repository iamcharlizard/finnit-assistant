import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { ColorPicker, type ColorPickerProps } from './color-picker';

function Controlled(props: ColorPickerProps) {
  const [value, setValue] = React.useState(props.value);
  return (
    <div className="flex max-w-xs flex-col gap-3">
      <ColorPicker {...props} value={value} onChange={setValue} />
      <p className="text-xs text-on-surface-variant">
        value: <code>{value ?? 'undefined'}</code>
      </p>
    </div>
  );
}

const meta = {
  title: 'UI/ColorPicker',
  component: ColorPicker,
  render: (args) => <Controlled {...args} />,
} satisfies Meta<typeof ColorPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Preset: Story = { args: { value: '#5B61C2' } };
export const Custom: Story = { args: { value: '#3FA7D6' } };
export const Empty: Story = { args: {} };
export const SpanishTexts: Story = {
  args: {
    value: '#00696E',
    swatchesLabel: 'Colores sugeridos',
    customLabel: 'Color personalizado',
    hexLabel: 'Código hexadecimal',
    invalidHexText: 'Usa el formato #RRGGBB.',
    presets: [
      { value: '#00696E', label: 'Verde azulado' },
      { value: '#5B61C2', label: 'Índigo' },
      { value: '#BA1A1A', label: 'Rojo' },
      { value: '#F2B600', label: 'Amarillo' },
    ],
  },
};
export const Disabled: Story = { args: { value: '#BA1A1A', disabled: true } };
export const Light: Story = {
  args: { value: '#F2B600' },
  parameters: { themes: { themeOverride: 'light' } },
};
export const Dark: Story = {
  args: { value: '#F2B600' },
  parameters: { themes: { themeOverride: 'dark' } },
};
