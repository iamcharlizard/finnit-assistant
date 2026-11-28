'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { cn } from '@finnit/ui/lib/utils';

import type { NavSection } from '@/lib/nav/sections';
import { TAB, TAB_ICON, TAB_LABEL } from './app-bottom-nav';

type AdminTabKey = 'adminUsers' | 'waitlist' | 'adminAi' | 'adminBanks';

function isAdminTabKey(key: string): key is AdminTabKey {
  return ['adminUsers', 'waitlist', 'adminAi', 'adminBanks'].includes(key);
}

/**
 * The bottom bar of an admin account below lg: every panel screen as a
 * tab, no "+" (admins don't record movements). Same glass pill and tabs as
 * AppBottomNav.
 */
export function AdminBottomNav({
  sections,
  activeHref,
  className,
}: {
  sections: ReadonlyArray<NavSection>;
  activeHref: string | null;
  className?: string;
}) {
  const t = useTranslations('nav');
  const entries = sections.flatMap((s) => s.items);

  return (
    <nav
      aria-label={t('mainNavigation')}
      className={cn(
        'fixed inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 mx-auto w-fit',
        className,
      )}
    >
      <div className="glass flex items-center gap-2 rounded-full border border-glass-border bg-glass p-2 shadow-elevation md:gap-4">
        {entries.map((entry) => {
          const isActive = entry.href === activeHref;
          const Icon = entry.icon;
          const label = isAdminTabKey(entry.key)
            ? t(`adminShort.${entry.key}`)
            : t(`items.${entry.key}`);
          return (
            <Link
              key={entry.href}
              href={entry.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                TAB,
                isActive
                  ? 'bg-primary/15 text-brand-ink dark:bg-primary/20'
                  : 'text-on-surface-variant',
              )}
            >
              <Icon aria-hidden className={TAB_ICON} />
              <span className={TAB_LABEL}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
