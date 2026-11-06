import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from './button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu';

const meta = {
  title: 'UI/DropdownMenu',
  component: DropdownMenu,
} satisfies Meta<typeof DropdownMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

const KINDS = [
  ['subscription', 'Suscripción', 8],
  ['utility', 'Servicio', 3],
  ['loan', 'Préstamo', 4],
  ['insurance', 'Seguro', 2],
] as const;

function CheckboxFilter() {
  const [checked, setChecked] = React.useState<string[]>(['loan']);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          Tipo{checked.length ? ` (${checked.length})` : ''}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Tipo</DropdownMenuLabel>
        {KINDS.map(([value, label, count]) => (
          <DropdownMenuCheckboxItem
            key={value}
            checked={checked.includes(value)}
            onCheckedChange={(on) =>
              setChecked((current) =>
                on ? [...current, value] : current.filter((v) => v !== value),
              )
            }
          >
            <span className="flex-1">{label}</span>
            <span className="text-xs text-on-surface-variant">{count}</span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RadioFilter() {
  const [value, setValue] = React.useState('active');
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Estado</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup value={value} onValueChange={setValue}>
          <DropdownMenuRadioItem value="active">Activos</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="paused">En pausa</DropdownMenuRadioItem>
          <DropdownMenuSeparator />
          <DropdownMenuRadioItem value="all">Todos</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Several choices at once; the menu stays open while checking. */
export const Checkboxes: Story = { render: () => <CheckboxFilter /> };

export const Radio: Story = { render: () => <RadioFilter /> };
