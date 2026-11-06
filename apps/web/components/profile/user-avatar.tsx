'use client';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@finnit/ui/components/ui/avatar';
import { cn } from '@finnit/ui/lib/utils';

import { initials, type SessionUser } from '@/components/session-provider';
import { avatarSrc } from '@/lib/profile/avatar';

/**
 * The user's photo (uploaded, or their Google picture), or their initials
 * while it loads or when there is none or it fails.
 */
export function UserAvatar({
  user,
  className,
}: {
  user: Pick<SessionUser, 'name' | 'avatar'>;
  className?: string;
}) {
  const src = avatarSrc(user.avatar);
  return (
    <Avatar className={className}>
      {src ? (
        // Google's image hosts refuse some requests that send a referrer.
        <AvatarImage src={src} alt="" referrerPolicy="no-referrer" />
      ) : null}
      <AvatarFallback className={cn('text-xs')}>
        {initials(user.name)}
      </AvatarFallback>
    </Avatar>
  );
}
