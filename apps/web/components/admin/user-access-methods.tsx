import { KeyRound } from 'lucide-react';

import { GoogleIcon } from '@finnit/ui/components/ui/google-icon';

import type { AdminUser } from '@/lib/admin/users';

/** How someone can sign in: password, Google (once linked) or neither yet. */
export function UserAccessMethods({
  user,
}: {
  user: Pick<AdminUser, 'hasPassword' | 'hasGoogle'>;
}) {
  if (!user.hasPassword && !user.hasGoogle) {
    return (
      <span className="text-[13px] text-on-surface-variant">
        Google (aún no entra)
      </span>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-on-surface-variant">
      {user.hasPassword ? (
        <span className="flex items-center gap-1">
          <KeyRound aria-hidden className="size-3.5" /> Contraseña
        </span>
      ) : null}
      {user.hasGoogle ? (
        <span className="flex items-center gap-1">
          <GoogleIcon aria-hidden className="size-3.5" /> Google
        </span>
      ) : null}
    </span>
  );
}
