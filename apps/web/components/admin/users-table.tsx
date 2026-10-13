'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@finnit/ui/components/ui/table';

import {
  formatLastSignIn,
  type AdminUser,
  type UserAction,
} from '@/lib/admin/users';
import { UserAccessMethods } from './user-access-methods';
import { UserActionsMenu } from './user-actions-menu';
import { UserRoleBadge } from './user-role-badge';
import { UserStatusBadge } from './user-status-badge';

/** Wide screens (lg): one row per user. */
export function UsersTable({
  users,
  actionsFor,
  onAction,
  className,
}: {
  users: AdminUser[];
  actionsFor: (user: AdminUser) => UserAction[];
  onAction: (action: UserAction, user: AdminUser) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Usuario</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Acceso</TableHead>
            <TableHead>Último ingreso</TableHead>
            <TableHead>Agregado por</TableHead>
            <TableHead className="w-12">
              <span className="sr-only">Acciones</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="max-w-64">
                <p className="truncate font-medium">{user.name}</p>
                <p className="truncate text-[13px] text-on-surface-variant">
                  {user.email}
                </p>
              </TableCell>
              <TableCell>
                <UserRoleBadge user={user} />
              </TableCell>
              <TableCell>
                <UserStatusBadge status={user.status} />
              </TableCell>
              <TableCell>
                <UserAccessMethods user={user} />
              </TableCell>
              <TableCell className="whitespace-nowrap text-[13px] text-on-surface-variant">
                {formatLastSignIn(user.lastLoginAt)}
              </TableCell>
              <TableCell className="text-[13px] text-on-surface-variant">
                {user.invitedByName ?? '—'}
              </TableCell>
              <TableCell className="text-right">
                <UserActionsMenu
                  user={user}
                  actions={actionsFor(user)}
                  onAction={onAction}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
