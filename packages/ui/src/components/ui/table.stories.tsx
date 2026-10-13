import type { Meta, StoryObj } from '@storybook/react-vite';

import { Badge } from './badge';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './table';

const meta = {
  title: 'UI/Table',
  component: Table,
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

const rows = [
  { name: 'Carlos Pérez', email: 'carlos@ejemplo.com', role: 'Maestro' },
  { name: 'Ana López', email: 'ana@ejemplo.com', role: 'Administrador' },
  { name: 'Luis Díaz', email: 'luis@ejemplo.com', role: 'Usuario' },
];

export const Default: Story = {
  render: () => (
    <Table>
      <TableCaption>3 usuarios</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Nombre</TableHead>
          <TableHead>Correo</TableHead>
          <TableHead>Rol</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.email}>
            <TableCell className="font-medium">{row.name}</TableCell>
            <TableCell className="text-on-surface-variant">
              {row.email}
            </TableCell>
            <TableCell>
              <Badge variant="muted">{row.role}</Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
};
