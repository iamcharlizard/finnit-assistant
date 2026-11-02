import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from './button';
import {
  Dialog,
  DialogBody,
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

/** Only the body scrolls; the title and the buttons stay visible. */
export const ScrollableContent: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" label="Ver términos" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Términos del préstamo</DialogTitle>
          <DialogDescription>
            Revisa las condiciones antes de registrar el préstamo.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {Array.from({ length: 12 }, (_, i) => (
            <Input
              key={i}
              label={`Campo ${i + 1}`}
              placeholder="Escribe un valor"
            />
          ))}
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" label="Cancelar" />
          </DialogClose>
          <Button variant="secondary" label="Guardar" />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
