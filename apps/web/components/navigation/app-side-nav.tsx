'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Plus, Wallet } from 'lucide-react';

import { cn } from '@finnit/ui/lib/utils';

import type { NavEntry, NavSection } from '@/lib/nav/sections';

const LINK =
  'flex min-h-11 items-center gap-3 rounded-chip px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50';

/**
 * Desktop sidebar (≥ lg) grouped by sections. Same look as @finnit/ui's
 * SideNav, which has no groups: a one-screen section is a plain link named
 * after the section; a bigger one gets a heading above its links.
 */
export function AppSideNav({
  sections,
  activeHref,
  onAddClick,
  className,
}: {
  sections: ReadonlyArray<NavSection>;
  activeHref: string | null;
  onAddClick: () => void;
  className?: string;
}) {
  const t = useTranslations('nav');

  const link = (entry: NavEntry, label: string) => {
    const isActive = entry.href === activeHref;
    const Icon = entry.icon;
    return (
      <Link
        key={entry.href}
        href={entry.href}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          LINK,
          isActive
            ? 'bg-primary/15 text-on-background dark:bg-primary/20'
            : 'text-on-surface-variant hover:bg-accent hover:text-on-background',
        )}
      >
        <Icon
          aria-hidden
          className={cn('size-5', isActive && 'text-brand-ink')}
        />
        {label}
      </Link>
    );
  };

  return (
    <aside
      className={cn(
        'flex h-full w-64 flex-col gap-6 overflow-y-auto border-r border-outline bg-surface/80 p-4 backdrop-blur-xl dark:bg-background/80',
        className,
      )}
    >
      <div className="flex items-center gap-3 px-2 pt-2">
        <span className="flex size-10 items-center justify-center rounded-xl bg-accent-neon text-white shadow-[0_4px_20px_rgba(108,114,203,0.35)] dark:text-[#00363a] dark:shadow-[0_0_20px_rgba(0,245,255,0.45)]">
          <Wallet aria-hidden className="size-5" />
        </span>
        <span className="text-title-lg font-bold text-brand-ink">Finnit</span>
      </div>

      <button
        type="button"
        onClick={onAddClick}
        className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <Plus aria-hidden className="size-4" />
        {t('newTransaction')}
      </button>

      <nav
        aria-label={t('mainNavigation')}
        className="flex flex-1 flex-col gap-1"
      >
        {sections.map((section) => {
          const [only] = section.items;
          if (section.items.length === 1 && only) {
            return link(only, t(`sections.${section.key}`));
          }
          const headingId = `nav-section-${section.key}`;
          return (
            <div
              key={section.key}
              role="group"
              aria-labelledby={headingId}
              className="mt-3 flex flex-col gap-1"
            >
              <span
                id={headingId}
                className="px-3 pb-1 text-[11px] font-medium uppercase tracking-[0.15em] text-on-surface-variant"
              >
                {t(`sections.${section.key}`)}
              </span>
              {section.items.map((entry) =>
                link(entry, t(`items.${entry.key}`)),
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
