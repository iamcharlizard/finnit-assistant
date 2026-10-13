'use client';

import { useLocale, useTranslations } from 'next-intl';
import { GlassCard } from '@finnit/ui/components/ui/glass-card';

import {
  formatLastSignIn,
  type AdminUser,
  type UserAction,
} from '@/lib/admin/users';
import { UserAccessMethods } from './user-access-methods';
import { UserActionsMenu } from './user-actions-menu';
import { UserRoleBadge } from './user-role-badge';
import { UserStatusBadge } from './user-status-badge';

/** Narrow screens: one card per user. */
export function UserCard({
  user,
  actions,
  onAction,
}: {
  user: AdminUser;
  actions: UserAction[];
  onAction: (action: UserAction, user: AdminUser) => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  return (
    <GlassCard className="flex flex-col gap-3 rounded-card p-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-on-background">{user.name}</p>
          <p className="truncate text-[13px] text-on-surface-variant">
            {user.email}
          </p>
        </div>
        <UserActionsMenu user={user} actions={actions} onAction={onAction} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <UserRoleBadge user={user} />
        <UserStatusBadge status={user.status} />
        <UserAccessMethods user={user} />
      </div>
      <p className="text-[13px] text-on-surface-variant">
        {[
          t('admin.users.lastSignInLine', {
            when: formatLastSignIn(user.lastLoginAt, { locale, t }),
          }),
          user.invitedByName
            ? t('admin.users.addedByLine', { name: user.invitedByName })
            : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
    </GlassCard>
  );
}
