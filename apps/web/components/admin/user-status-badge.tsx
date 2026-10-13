import { useTranslations } from 'next-intl';

import { Badge } from '@finnit/ui/components/ui/badge';

import type { UserStatus } from '@/lib/admin/users';

export function UserStatusBadge({ status }: { status: UserStatus }) {
  const t = useTranslations('admin.users.statuses');
  return (
    <Badge variant={status === 'active' ? 'success' : 'expense'}>
      {t(status)}
    </Badge>
  );
}
