import type { Meta, StoryObj } from '@storybook/react-vite';

import { Checkbox } from './checkbox';
import { Label } from './label';
import { Switch } from './switch';

const meta = {
  title: 'UI/Form controls',
  component: Switch,
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SwitchStates: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Switch id="s-on" defaultChecked />
        <Label htmlFor="s-on">Pago sin contacto</Label>
      </div>
      <div className="flex items-center gap-3">
        <Switch id="s-off" />
        <Label htmlFor="s-off">Compras internacionales</Label>
      </div>
      <div className="flex items-center gap-3">
        <Switch id="s-disabled" disabled />
        <Label htmlFor="s-disabled">Deshabilitado</Label>
      </div>
    </div>
  ),
};

export const CheckboxStates: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Checkbox id="c-on" defaultChecked />
        <label htmlFor="c-on" className="text-sm text-on-surface-variant">
          Mantener sesión iniciada
        </label>
      </div>
      <div className="flex items-center gap-3">
        <Checkbox id="c-off" />
        <label htmlFor="c-off" className="text-sm text-on-surface-variant">
          Acepto los términos
        </label>
      </div>
    </div>
  ),
};
