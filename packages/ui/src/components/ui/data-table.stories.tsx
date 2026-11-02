import type { Meta, StoryObj } from '@storybook/react-vite';

import { Badge } from './badge';
import { DataTable, type ColumnDef } from './data-table';

interface Payment {
  number: number;
  date: string;
  amount: string;
  balance: string;
  paid: boolean;
}

const payments: Payment[] = Array.from({ length: 24 }, (_, i) => ({
  number: i + 1,
  date: `2026-${String((i % 12) + 1).padStart(2, '0')}-26`,
  amount: '$10,667.13',
  balance: `$${(200_000 - (i + 1) * 8_000).toLocaleString('en-US')}.00`,
  paid: i < 10,
}));

const columns: ColumnDef<Payment>[] = [
  {
    accessorKey: 'number',
    header: '#',
    enableSorting: true,
    meta: { align: 'right' },
  },
  { accessorKey: 'date', header: 'Fecha', enableSorting: true },
  { accessorKey: 'amount', header: 'Pago', meta: { align: 'right' } },
  { accessorKey: 'balance', header: 'Saldo', meta: { align: 'right' } },
  {
    id: 'status',
    header: 'Estado',
    cell: ({ row }) =>
      row.original.paid ? (
        <Badge variant="income">Pagado</Badge>
      ) : (
        <Badge variant="outline">Por pagar</Badge>
      ),
  },
];

const meta = {
  title: 'UI/Data table',
  component: DataTable,
  parameters: {
    docs: {
      description: {
        component: `
Tabla sobre **TanStack Table** (v8). Úsala para cualquier tabla de datos.

- Paginada: 5 filas por página por omisión, con selector de filas por página
  junto al paginador (\`pageSize\`, \`pageSizes\`, \`paginate={false}\` para
  mostrar todo). El paginador se oculta si caben todas en la página más chica.
- Ordenable solo en las columnas con \`enableSorting: true\`.
- \`meta.align: 'right'\` alinea montos (con números tabulares);
  \`meta.cellClassName\` / \`headerClassName\` para estilos por columna.
- \`initialRowIndex\` abre en la página de esa fila (p. ej. el próximo pago).
- Textos con \`labels\` (inglés por omisión).
        `,
      },
    },
  },
} satisfies Meta<typeof DataTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { columns: columns as never, data: payments as never },
};

export const OpensOnNextPayment: Story = {
  args: {
    columns: columns as never,
    data: payments as never,
    initialRowIndex: 10,
  },
};

export const Empty: Story = {
  args: { columns: columns as never, data: [] },
};
