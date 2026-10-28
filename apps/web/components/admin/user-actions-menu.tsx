'use client';

import { useTranslations } from 'next-intl';
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

/** Labels are `admin.users.actions.<action>`. */
const ITEMS: Record<UserAction, { icon: LucideIcon; destructive?: boolean }> = {
  setPassword: { icon: KeyRound },
  removePassword: { icon: KeyRound, destructive: true },
  unlinkGoogle: { icon: Unlink, destructive: true },
  makeAdmin: { icon: ShieldPlus },
  removeAdmin: { icon: ShieldMinus, destructive: true },
  enable: { icon: UserCheck },
  disable: { icon: UserX, destructive: true },
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
  const t = useTranslations('admin.users.actions');
  if (!actions.length) return null;
  const safe = actions.filter((a) => !ITEMS[a].destructive);
  const destructive = actions.filter((a) => ITEMS[a].destructive);

  const item = (action: UserAction) => {
    const { icon: Icon, destructive: isDestructive } = ITEMS[action];
    return (
      <DropdownMenuItem
        key={action}
        onSelect={() => onAction(action, user)}
        className={
          isDestructive ? 'text-expense [&_svg]:text-expense' : undefined
        }
      >
        <Icon /> {t(action)}
      </DropdownMenuItem>
    );
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('menuLabel', { name: user.name })}
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
