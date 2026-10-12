import type { Meta, StoryObj } from '@storybook/react-vite';
import { LogOut, Settings, User } from 'lucide-react';

import { Button } from './button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from './sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './tooltip';

const meta = {
  title: 'UI/Overlays',
  component: DropdownMenu,
} satisfies Meta<typeof DropdownMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Menu: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" label="Mi cuenta" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Alex Neumann</DropdownMenuLabel>
        <DropdownMenuItem>
          <User /> Perfil
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Settings /> Configuración
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-expense">
          <LogOut /> Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

export const SideSheet: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="secondary" label="Abrir panel" />
      </SheetTrigger>
      <SheetContent className="p-6">
        <SheetTitle>Nueva transacción</SheetTitle>
        <SheetDescription>
          Aquí irá el formulario para registrar un ingreso o gasto.
        </SheetDescription>
      </SheetContent>
    </Sheet>
  ),
};

export const Hint: Story = {
  render: () => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" label="Pasa el cursor" />
        </TooltipTrigger>
        <TooltipContent>Saldo actualizado hace 2 min</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
};
