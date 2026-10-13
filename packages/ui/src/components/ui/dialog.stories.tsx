import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from './button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog';
import { Input } from './input';

const meta = {
  title: 'UI/Dialog',
  component: Dialog,
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Form: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" label="Agregar usuario" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar usuario</DialogTitle>
          <DialogDescription>
            Podrá entrar con su contraseña o con Google.
          </DialogDescription>
        </DialogHeader>
        <Input label="Nombre" placeholder="Ana López" />
        <Input label="Correo" type="email" placeholder="ana@ejemplo.com" />
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" label="Cancelar" />
          </DialogClose>
          <Button variant="secondary" label="Agregar" />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
