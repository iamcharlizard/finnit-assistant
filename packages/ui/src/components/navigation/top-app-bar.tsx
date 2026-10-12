'use client';

import * as React from 'react';
import { Bell } from 'lucide-react';

import { cn } from '../../lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

interface TopAppBarProps {
  title: string;
  avatarSrc?: string;
  avatarFallback?: string;
  notificationCount?: number;
  onNotificationsClick?: () => void;
  onAvatarClick?: () => void;
  /** Extra leading content, e.g. a menu button on small screens. */
  leading?: React.ReactNode;
  className?: string;
}

function TopAppBar({
  title,
  avatarSrc,
  avatarFallback,
  notificationCount = 0,
  onNotificationsClick,
  onAvatarClick,
  leading,
  className,
}: TopAppBarProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex items-center justify-between border-b border-outline bg-surface/88 px-4 py-2 shadow-[0_2px_16px_rgba(0,0,0,0.05)] backdrop-blur-xl dark:bg-background/88 dark:shadow-[0_2px_16px_rgba(0,0,0,0.3)]',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        {leading}
        <span className="text-title-lg font-bold text-brand-ink">{title}</span>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onNotificationsClick}
          aria-label={
            notificationCount > 0
              ? `Notificaciones, ${notificationCount} nuevas`
              : 'Notificaciones'
          }
          className="relative flex size-11 items-center justify-center rounded-full text-on-surface-variant outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Bell aria-hidden className="size-[22px] fill-current" />
          {notificationCount > 0 ? (
            <span className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full bg-[#ba1a1a] text-[9px] font-bold text-white">
              {notificationCount > 9 ? '9+' : notificationCount}
            </span>
          ) : null}
        </button>

        {avatarSrc || avatarFallback ? (
          <button
            type="button"
            onClick={onAvatarClick}
            aria-label="Perfil de usuario"
            className="flex size-11 items-center justify-center rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <Avatar className="border-2 border-primary">
              {avatarSrc ? <AvatarImage src={avatarSrc} alt="" /> : null}
              <AvatarFallback>{avatarFallback}</AvatarFallback>
            </Avatar>
          </button>
        ) : null}
      </div>
    </header>
  );
}

export { TopAppBar, type TopAppBarProps };
