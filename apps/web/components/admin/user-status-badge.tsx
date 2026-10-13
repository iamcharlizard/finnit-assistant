import { Badge } from '@finnit/ui/components/ui/badge';

import type { UserStatus } from '@/lib/admin/users';

export function UserStatusBadge({ status }: { status: UserStatus }) {
  return status === 'active' ? (
    <Badge variant="success">Activo</Badge>
  ) : (
    <Badge variant="expense">Desactivado</Badge>
  );
}
