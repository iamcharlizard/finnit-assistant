'use client';

import * as React from 'react';
import { Bell } from 'lucide-react';

import { cn } from '../../lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

interface TopAppBarProps {
  title: string;
  /** Renders the title as the page's `<h1>` (when the screen has no heading of its own). */
  titleAs?: 'h1' | 'span';
  /** Line under the title. From `sm` it sits in the bar; below, under it. */
  subtitle?: React.ReactNode;
  /** Page actions (buttons, toggles) before the bell. Below `sm`, under the bar. */
  actions?: React.ReactNode;
  avatarSrc?: string;
  avatarFallback?: string;
  notificationCount?: number;
  onNotificationsClick?: () => void;
  onAvatarClick?: () => void;
  /** Icon buttons before the bell, e.g. the light/dark toggle. Always visible. */
  tools?: React.ReactNode;
  /** Extra leading content, e.g. a menu button on small screens. */
  leading?: React.ReactNode;
  /** Accessible name of the bell button; receives the unread count. */
  notificationsLabel?: (count: number) => string;
  /** Accessible name of the avatar button. */
  profileLabel?: string;
  className?: string;
}

const defaultNotificationsLabel = (count: number) =>
  count > 0 ? `Notifications, ${count} new` : 'Notifications';

function TopAppBar({
  title,
  titleAs: Title = 'span',
  subtitle,
  actions,
  avatarSrc,
  avatarFallback,
  notificationCount = 0,
  onNotificationsClick,
  onAvatarClick,
  tools,
  leading,
  notificationsLabel = defaultNotificationsLabel,
  profileLabel = 'User profile',
  className,
}: TopAppBarProps) {
  /*
   * Floating glass pill: it sticks a little below the top with a translucent
   * background and blur (strength and colors come from the theme tokens).
   * The negative margins offset the padding, so the title lines up with the
   * page.
   */
  return (
    <>
      <header
        className={cn(
          // A pill: fully round ends. The right padding equals the vertical one, so
          // the round bell and avatar sit concentric with the end; the title gets
          // a little more room from the curve.
          'glass sticky top-3 z-30 -mx-3 flex items-center justify-between gap-3 rounded-full border border-glass-border bg-glass py-2.5 pr-2.5 pl-5 shadow-elevation sm:-mx-5 sm:py-3 sm:pr-3 sm:pl-6',
          className,
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          {leading}
          <div className="flex min-w-0 flex-col">
            <Title className="truncate text-title-lg font-bold text-brand-ink">
              {title}
            </Title>
            {subtitle ? (
              <p className="hidden truncate text-sm text-on-surface-variant sm:block">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {actions ? (
            <div className="mr-2 hidden items-center gap-3 sm:flex">
              {actions}
            </div>
          ) : null}
          {tools}
          <button
            type="button"
            onClick={onNotificationsClick}
            aria-label={notificationsLabel(notificationCount)}
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
              aria-label={profileLabel}
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
      {subtitle || actions ? (
        <div className="flex flex-col gap-3 pt-1 sm:hidden">
          {subtitle ? (
            <p className="text-sm text-on-surface-variant">{subtitle}</p>
          ) : null}
          {actions ? (
            <div className="flex flex-wrap items-center gap-3">{actions}</div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

export { TopAppBar, type TopAppBarProps };
