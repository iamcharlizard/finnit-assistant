import { Badge } from '@finnit/ui/components/ui/badge';

import { roleLabel, type AdminUser } from '@/lib/admin/users';

export function UserRoleBadge({
  user,
}: {
  user: Pick<AdminUser, 'role' | 'isMaster'>;
}) {
  const variant = user.isMaster
    ? 'highlight'
    : user.role === 'admin'
      ? 'brand'
      : 'muted';
  return <Badge variant={variant}>{roleLabel(user)}</Badge>;
}
