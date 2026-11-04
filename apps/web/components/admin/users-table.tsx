'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { DataTable, type ColumnDef } from '@finnit/ui/components/ui/data-table';

import { useTableLabels } from '@/components/use-table-labels';
import {
  formatLastSignIn,
  type AdminUser,
  type UserAction,
} from '@/lib/admin/users';
import { UserAccessMethods } from './user-access-methods';
import { UserActionsMenu } from './user-actions-menu';
import { UserRoleBadge } from './user-role-badge';
import { UserStatusBadge } from './user-status-badge';

/** Wide content (@3xl): one row per user, sortable by name and last sign-in. */
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
  const t = useTranslations();
  const locale = useLocale();
  const labels = useTableLabels();

  const columns = React.useMemo<ColumnDef<AdminUser>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('admin.users.columns.user'),
        enableSorting: true,
        cell: ({ row }) => (
          <>
            <p className="truncate font-medium">{row.original.name}</p>
            <p className="truncate text-[13px] text-on-surface-variant">
              {row.original.email}
            </p>
          </>
        ),
        meta: { cellClassName: 'max-w-64' },
      },
      {
        id: 'role',
        header: t('admin.users.columns.role'),
        cell: ({ row }) => <UserRoleBadge user={row.original} />,
      },
      {
        id: 'status',
        header: t('admin.users.columns.status'),
        cell: ({ row }) => <UserStatusBadge status={row.original.status} />,
      },
      {
        id: 'access',
        header: t('admin.users.columns.access'),
        cell: ({ row }) => <UserAccessMethods user={row.original} />,
      },
      {
        id: 'lastSignIn',
        accessorFn: (user) => user.lastLoginAt ?? '',
        header: t('admin.users.columns.lastSignIn'),
        enableSorting: true,
        sortingFn: 'text',
        cell: ({ row }) =>
          formatLastSignIn(row.original.lastLoginAt, { locale, t }),
        meta: {
          cellClassName:
            'whitespace-nowrap text-[13px] text-on-surface-variant',
        },
      },
      {
        id: 'addedBy',
        header: t('admin.users.columns.addedBy'),
        cell: ({ row }) => row.original.invitedByName ?? '—',
        meta: { cellClassName: 'text-[13px] text-on-surface-variant' },
      },
      {
        id: 'actions',
        header: () => (
          <span className="sr-only">{t('admin.users.columns.actions')}</span>
        ),
        cell: ({ row }) => (
          <UserActionsMenu
            user={row.original}
            actions={actionsFor(row.original)}
            onAction={onAction}
          />
        ),
        meta: { align: 'right', headerClassName: 'w-12' },
      },
    ],
    [t, locale, actionsFor, onAction],
  );

  return (
    <DataTable
      columns={columns}
      data={users}
      getRowId={(user) => user.id}
      labels={labels}
      className={className}
    />
  );
}
