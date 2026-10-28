'use client';

import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';

import { InputWithIcon } from '@finnit/ui/components/ui/input-with-icon';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@finnit/ui/components/ui/select';

import type { UserRole, UserStatus } from '@/lib/admin/users';

const ALL = 'all';

/** Search (by name or email) and the status / role filters. */
export function UsersToolbar({
  search,
  onSearchChange,
  status,
  onStatusChange,
  role,
  onRoleChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  status?: UserStatus;
  onStatusChange: (value?: UserStatus) => void;
  role?: UserRole;
  onRoleChange: (value?: UserRole) => void;
}) {
  const t = useTranslations('admin.users');
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex-1">
        <InputWithIcon
          aria-label={t('search')}
          iconLeft={Search}
          type="search"
          placeholder={t('search')}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:flex">
        <Select
          value={status ?? ALL}
          onValueChange={(v) =>
            onStatusChange(v === ALL ? undefined : (v as UserStatus))
          }
        >
          <SelectTrigger aria-label={t('status')} className="min-h-12 sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('allStatuses')}</SelectItem>
            <SelectItem value="active">{t('activePlural')}</SelectItem>
            <SelectItem value="disabled">{t('disabledPlural')}</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={role ?? ALL}
          onValueChange={(v) =>
            onRoleChange(v === ALL ? undefined : (v as UserRole))
          }
        >
          <SelectTrigger aria-label={t('role')} className="min-h-12 sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('allRoles')}</SelectItem>
            <SelectItem value="admin">{t('adminsPlural')}</SelectItem>
            <SelectItem value="user">{t('usersPlural')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
