'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
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
import type { Translate } from '@/lib/i18n/translator';
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
  t: Translate,
): Omit<ConfirmRequest, 'onConfirm'> {
  const values = { name: user.name, email: user.email };
  return {
    title: t(`admin.users.confirm.${action}.title`, values),
    description: t(`admin.users.confirm.${action}.description`, values),
    confirmLabel: t(`admin.users.actions.${action}`),
    destructive: action !== 'enable' && action !== 'makeAdmin',
  };
}

/** /admin/users: who can use Finnit and how they sign in. */
export function AdminUsersScreen() {
  const me = useSessionUser();
  const t = useTranslations();
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
      setNotice({ text: adminErrorMessage(error, t), error: true });
    }
  }

  function handleAction(action: UserAction, user: AdminUser) {
    if (action === 'setPassword') {
      setPasswordFor(user);
      return;
    }
    setConfirm({
      ...confirmCopy(action, user, t),
      onConfirm: () => void run(action, user),
    });
  }

  const filtered = Boolean(debouncedSearch.trim() || status || role);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BodyMd className="text-on-surface-variant">
          {list.loading
            ? t('admin.users.loading')
            : t('admin.users.count', { count: list.totalCount })}
        </BodyMd>
        <Button variant="secondary" onClick={() => setCreating(true)}>
          <UserPlus className="size-4" /> {t('admin.users.add')}
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
            {t('common.retry')}
          </Button>
        </div>
      ) : !list.loading && list.users.length === 0 ? (
        <BodyMd className="rounded-card bg-track p-6 text-center text-on-surface-variant">
          {filtered ? t('admin.users.noMatch') : t('admin.users.empty')}
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
          {list.loadingMore ? t('common.loading') : t('common.loadMore')}
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
