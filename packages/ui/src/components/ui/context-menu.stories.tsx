import type { Meta, StoryObj } from '@storybook/react-vite';
import { ArrowLeftRight, Ban, Eye, Pencil, Trash2 } from 'lucide-react';

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from './context-menu';

const meta = {
  title: 'UI/Context menu',
  component: ContextMenu,
} satisfies Meta<typeof ContextMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MovementActions: Story = {
  render: () => (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="flex h-32 w-80 items-center justify-center rounded-2xl border border-dashed border-outline text-sm text-on-surface-variant">
          Clic derecho aquí
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem>
          <Eye /> Ver detalle
        </ContextMenuItem>
        <ContextMenuItem>
          <Pencil /> Renombrar <ContextMenuShortcut>F2</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem>
          <ArrowLeftRight /> Convertir en transferencia
        </ContextMenuItem>
        <ContextMenuItem>
          <Ban /> Marcar como cancelado
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive">
          <Trash2 /> Eliminar
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  ),
};
