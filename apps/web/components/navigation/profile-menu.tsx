'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import {
  ChevronsUpDown,
  LogOut,
  Monitor,
  Moon,
  Palette,
  Settings,
  Sun,
} from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@finnit/ui/components/ui/dropdown-menu';
import { cn } from '@finnit/ui/lib/utils';

import { signOut } from '@/app/login/actions';
import { useAppTheme } from '@/components/app-theme-provider';
import { UserAvatar } from '@/components/profile/user-avatar';
import { useSessionUser } from '@/components/session-provider';
import { ThemeSwatch } from '@/components/theme-picker';
import { SETTINGS_HREF } from '@/lib/nav/sections';
import { APP_THEMES, type AppTheme } from '@/lib/theme/app-theme';

const MODES = [
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
  { value: 'system', icon: Monitor },
] as const;

/** The menu's items: light/dark, theme, settings and sign out. */
function ProfileMenuItems() {
  const t = useTranslations('profileMenu');
  const tm = useTranslations('ui.mode');
  const tt = useTranslations('ui.theme');
  const { theme: mode, setTheme: setMode } = useTheme();
  const { theme, setTheme } = useAppTheme();
  const user = useSessionUser();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const [signingOut, startSignOut] = React.useTransition();

  return (
    <>
      <DropdownMenuLabel className="flex flex-col gap-0.5 normal-case tracking-normal">
        <span className="truncate text-sm font-semibold text-on-background">
          {user.name}
        </span>
        <span className="truncate text-xs font-normal text-on-surface-variant">
          {user.email}
        </span>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuLabel>{tm('label')}</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={mounted ? (mode ?? 'system') : ''}
        onValueChange={setMode}
      >
        {MODES.map(({ value, icon: Icon }) => (
          <DropdownMenuRadioItem
            key={value}
            value={value}
            onSelect={(event) => event.preventDefault()}
          >
            <Icon aria-hidden />
            {value === 'system' ? t('systemMode') : tm(value)}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <Palette aria-hidden />
          <span className="flex-1">{tt('label')}</span>
          <span className="text-xs text-on-surface-variant">
            {tt(`names.${theme}`)}
          </span>
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="w-64">
          <DropdownMenuRadioGroup
            value={theme}
            onValueChange={(value) => setTheme(value as AppTheme)}
          >
            {APP_THEMES.map((option) => (
              <DropdownMenuRadioItem key={option} value={option}>
                <ThemeSwatch theme={option} className="size-7" />
                <span className="flex min-w-0 flex-col">
                  <span>{tt(`names.${option}`)}</span>
                  <span className="truncate text-xs text-on-surface-variant">
                    {tt(`descriptions.${option}`)}
                  </span>
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSeparator />
      <DropdownMenuItem asChild>
        <Link href={SETTINGS_HREF}>
          <Settings aria-hidden />
          {t('settings')}
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem
        disabled={signingOut}
        onSelect={() => startSignOut(() => signOut())}
      >
        <LogOut aria-hidden />
        {signingOut ? t('signingOut') : t('signOut')}
      </DropdownMenuItem>
    </>
  );
}

/**
 * The signed-in user's menu. In the sidebar it sits at the bottom (photo,
 * name and email; only the photo when collapsed); in the header (small
 * screens) it is the avatar button.
 */
export function ProfileMenu({
  variant,
  collapsed = false,
  active = false,
  className,
}: {
  variant: 'sidebar' | 'header';
  collapsed?: boolean;
  /** The current page is in Settings. */
  active?: boolean;
  className?: string;
}) {
  const t = useTranslations('profileMenu');
  const user = useSessionUser();

  if (variant === 'header') {
    return (
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t('open')}
            className={cn(
              'flex size-11 items-center justify-center rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
              className,
            )}
          >
            <UserAvatar user={user} className="border-2 border-primary" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <ProfileMenuItems />
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('open')}
          className={cn(
            'flex min-h-14 w-full items-center gap-3 rounded-chip py-2 pr-2 pl-[9px] text-left outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=open]:bg-accent',
            active && 'bg-primary/15 dark:bg-primary/20',
            className,
          )}
        >
          <UserAvatar user={user} className="size-8" />
          <span className="flex min-w-0 flex-1 flex-col transition-opacity duration-200 rail-collapsed:opacity-0">
            <span className="truncate text-sm font-semibold text-on-background">
              {user.name}
            </span>
            <span className="truncate text-xs text-on-surface-variant">
              {user.email}
            </span>
          </span>
          <ChevronsUpDown
            aria-hidden
            className="size-4 shrink-0 text-on-surface-variant rail-collapsed:hidden"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={collapsed ? 'right' : 'top'}
        align={collapsed ? 'end' : 'start'}
        sideOffset={collapsed ? 14 : 8}
        className="w-64"
      >
        <ProfileMenuItems />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
