'use client';

import * as React from 'react';
import { UserPlus } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { BodyMd } from '@finnit/ui/components/ui/typography';

import { useSessionUser } from '@/components/session-provider';
import { useAdminUsers } from '@/hooks/use-admin-users';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { adminErrorMessage } from '@/lib/admin/errors';
import {
  USER_ACTION_MUTATIONS,
  availableActions,
  type AdminUser,
  type UserAction,
  type UserRole,
  type UserStatus,
} from '@/lib/admin/users';
import { gql } from '@/lib/graphql/client';
import { ConfirmDialog, type ConfirmRequest } from './confirm-dialog';
import { CreateUserDialog } from './create-user-dialog';
import { SetPasswordDialog } from './set-password-dialog';
import { UserCard } from './user-card';
import { UsersTable } from './users-table';
import { UsersToolbar } from './users-toolbar';

type ConfirmableAction = keyof typeof USER_ACTION_MUTATIONS;

/** What each action asks before running. */
function confirmCopy(
  action: ConfirmableAction,
  user: AdminUser,
): Omit<ConfirmRequest, 'onConfirm'> {
  switch (action) {
    case 'removePassword':
      return {
        title: `¿Quitar la contraseña de ${user.name}?`,
        description:
          'Solo podrá entrar con Google y se cerrarán sus sesiones abiertas.',
        confirmLabel: 'Quitar contraseña',
        destructive: true,
      };
    case 'unlinkGoogle':
      return {
        title: `¿Desligar Google de ${user.name}?`,
        description: `Se cerrarán sus sesiones abiertas. Podrá volver a ligar una cuenta de Google de ${user.email} al entrar con ella.`,
        confirmLabel: 'Desligar Google',
        destructive: true,
      };
    case 'disable':
      return {
        title: `¿Desactivar a ${user.name}?`,
        description:
          'No podrá entrar a Finnit y se cerrarán sus sesiones abiertas. Sus datos se conservan y puedes reactivarlo después.',
        confirmLabel: 'Desactivar',
        destructive: true,
      };
    case 'enable':
      return {
        title: `¿Reactivar a ${user.name}?`,
        description: 'Podrá volver a entrar a Finnit.',
        confirmLabel: 'Reactivar',
      };
    case 'makeAdmin':
      return {
        title: `¿Hacer administrador a ${user.name}?`,
        description:
          'Podrá agregar usuarios, cambiar sus accesos y configurar la IA.',
        confirmLabel: 'Hacer administrador',
      };
    case 'removeAdmin':
      return {
        title: `¿Quitar administrador a ${user.name}?`,
        description: 'Seguirá usando Finnit, pero sin acceso a Administración.',
        confirmLabel: 'Quitar administrador',
        destructive: true,
      };
  }
}

/** /admin/users: who can use Finnit and how they sign in. */
export function AdminUsersScreen() {
  const me = useSessionUser();
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState<UserStatus>();
  const [role, setRole] = React.useState<UserRole>();
  const debouncedSearch = useDebouncedValue(search, 300);
  const list = useAdminUsers({ search: debouncedSearch, status, role });

  const [creating, setCreating] = React.useState(false);
  const [passwordFor, setPasswordFor] = React.useState<AdminUser | null>(null);
  const [confirm, setConfirm] = React.useState<ConfirmRequest | null>(null);
  const [notice, setNotice] = React.useState<{
    text: string;
    error?: boolean;
  } | null>(null);

  const actionsFor = React.useCallback(
    (user: AdminUser) => availableActions(user, me),
    [me],
  );

  async function run(action: ConfirmableAction, user: AdminUser) {
    setNotice(null);
    try {
      const data = await gql<{ result: AdminUser }>(
        USER_ACTION_MUTATIONS[action],
        { id: user.id },
      );
      if (user.id === me.id) {
        // On yourself only sign-in methods change, and that ends your sessions.
        window.location.assign('/login');
        return;
      }
      list.replace(data.result);
    } catch (error) {
      setNotice({ text: adminErrorMessage(error), error: true });
    }
  }

  function handleAction(action: UserAction, user: AdminUser) {
    if (action === 'setPassword') {
      setPasswordFor(user);
      return;
    }
    setConfirm({
      ...confirmCopy(action, user),
      onConfirm: () => void run(action, user),
    });
  }

  const filtered = Boolean(debouncedSearch.trim() || status || role);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BodyMd className="text-on-surface-variant">
          {list.loading
            ? 'Cargando usuarios…'
            : `${list.totalCount} ${list.totalCount === 1 ? 'usuario' : 'usuarios'}`}
        </BodyMd>
        <Button variant="secondary" onClick={() => setCreating(true)}>
          <UserPlus className="size-4" /> Agregar usuario
        </Button>
      </div>

      <UsersToolbar
        search={search}
        onSearchChange={setSearch}
        status={status}
        onStatusChange={setStatus}
        role={role}
        onRoleChange={setRole}
      />

      {notice ? (
        <p
          role={notice.error ? 'alert' : 'status'}
          className={
            notice.error
              ? 'text-[13px] text-expense'
              : 'text-[13px] text-on-surface-variant'
          }
        >
          {notice.text}
        </p>
      ) : null}

      {list.error ? (
        <div className="flex flex-col items-center gap-3 rounded-card bg-track p-6 text-center">
          <BodyMd className="text-expense">{list.error}</BodyMd>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void list.reload()}
          >
            Reintentar
          </Button>
        </div>
      ) : !list.loading && list.users.length === 0 ? (
        <BodyMd className="rounded-card bg-track p-6 text-center text-on-surface-variant">
          {filtered
            ? 'Nadie coincide con la búsqueda.'
            : 'Aún no hay usuarios.'}
        </BodyMd>
      ) : (
        <>
          <UsersTable
            users={list.users}
            actionsFor={actionsFor}
            onAction={handleAction}
            className="hidden rounded-card border border-glass-border bg-glass p-2 lg:block"
          />
          <div className="flex flex-col gap-3 lg:hidden">
            {list.users.map((user) => (
              <UserCard
                key={user.id}
                user={user}
                actions={actionsFor(user)}
                onAction={handleAction}
              />
            ))}
          </div>
        </>
      )}

      {list.hasNextPage && !list.error ? (
        <Button
          variant="outline"
          className="self-center"
          disabled={list.loadingMore}
          onClick={() => void list.loadMore()}
        >
          {list.loadingMore ? 'Cargando…' : 'Cargar más'}
        </Button>
      ) : null}

      {creating ? (
        <CreateUserDialog
          canChooseRole={me.isMaster}
          onClose={() => setCreating(false)}
          onCreated={() => void list.reload()}
        />
      ) : null}
      {passwordFor ? (
        <SetPasswordDialog
          user={passwordFor}
          isSelf={passwordFor.id === me.id}
          onClose={() => setPasswordFor(null)}
          onSaved={list.replace}
        />
      ) : null}
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
