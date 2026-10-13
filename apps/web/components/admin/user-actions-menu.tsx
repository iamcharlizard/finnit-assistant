'use client';

import {
  KeyRound,
  MoreHorizontal,
  ShieldMinus,
  ShieldPlus,
  Unlink,
  UserCheck,
  UserX,
  type LucideIcon,
} from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@finnit/ui/components/ui/dropdown-menu';

import type { AdminUser, UserAction } from '@/lib/admin/users';

const ITEMS: Record<
  UserAction,
  { label: string; icon: LucideIcon; destructive?: boolean }
> = {
  setPassword: { label: 'Asignar contraseña', icon: KeyRound },
  removePassword: {
    label: 'Quitar contraseña',
    icon: KeyRound,
    destructive: true,
  },
  unlinkGoogle: { label: 'Desligar Google', icon: Unlink, destructive: true },
  makeAdmin: { label: 'Hacer administrador', icon: ShieldPlus },
  removeAdmin: {
    label: 'Quitar administrador',
    icon: ShieldMinus,
    destructive: true,
  },
  enable: { label: 'Reactivar', icon: UserCheck },
  disable: { label: 'Desactivar', icon: UserX, destructive: true },
};

/** The "…" menu of a user row; `actions` already filtered by permissions. */
export function UserActionsMenu({
  user,
  actions,
  onAction,
}: {
  user: AdminUser;
  actions: UserAction[];
  onAction: (action: UserAction, user: AdminUser) => void;
}) {
  if (!actions.length) return null;
  const safe = actions.filter((a) => !ITEMS[a].destructive);
  const destructive = actions.filter((a) => ITEMS[a].destructive);

  const item = (action: UserAction) => {
    const { label, icon: Icon, destructive: isDestructive } = ITEMS[action];
    return (
      <DropdownMenuItem
        key={action}
        onSelect={() => onAction(action, user)}
        className={
          isDestructive ? 'text-expense [&_svg]:text-expense' : undefined
        }
      >
        <Icon /> {label}
      </DropdownMenuItem>
    );
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Acciones para ${user.name}`}
        >
          <MoreHorizontal className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {safe.map(item)}
        {safe.length && destructive.length ? <DropdownMenuSeparator /> : null}
        {destructive.map(item)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
