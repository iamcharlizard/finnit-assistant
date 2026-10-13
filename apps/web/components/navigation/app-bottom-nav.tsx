'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { CirclePlus, Ellipsis } from 'lucide-react';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@finnit/ui/components/ui/sheet';
import { cn } from '@finnit/ui/lib/utils';

import {
  BOTTOM_NAV_KEYS,
  isBottomNavKey,
  type BottomNavKey,
  type NavEntry,
  type NavSection,
} from '@/lib/nav/sections';

const TAB =
  'flex min-h-11 min-w-11 flex-col items-center justify-center rounded-chip px-3 py-1 text-[10px] font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';

/**
 * Mobile bottom bar (< lg), same look as @finnit/ui's BottomNavBar: two tabs,
 * the "+" button, a tab and "Más", which opens a sheet with every other
 * section.
 */
export function AppBottomNav({
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
  const tc = useTranslations('common');
  const [moreOpen, setMoreOpen] = React.useState(false);

  const entries = sections.flatMap((s) =>
    s.items.map((entry) => ({ entry, section: s })),
  );
  const tabs = BOTTOM_NAV_KEYS.flatMap((key) => {
    const entry = entries.find((e) => e.entry.key === key)?.entry;
    return entry ? [{ ...entry, key }] : [];
  });
  const rest = entries.filter((e) => !isBottomNavKey(e.entry.key));
  const moreActive = rest.some((e) => e.entry.href === activeHref);

  const tab = (entry: NavEntry & { key: BottomNavKey }) => {
    const isActive = entry.href === activeHref;
    const Icon = entry.icon;
    return (
      <Link
        key={entry.href}
        href={entry.href}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          TAB,
          isActive ? 'bg-primary/20 text-brand-ink' : 'text-on-surface-variant',
        )}
      >
        <Icon aria-hidden className="size-[22px]" />
        <span className="mt-0.5">{t(`short.${entry.key}`)}</span>
      </Link>
    );
  };

  return (
    <>
      <nav
        aria-label={t('mainNavigation')}
        className={cn(
          'fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-outline bg-surface/92 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-2px_16px_rgba(0,0,0,0.06)] backdrop-blur-xl dark:bg-background/92 dark:shadow-[0_-2px_16px_rgba(0,0,0,0.3)]',
          className,
        )}
      >
        {tabs.slice(0, 2).map(tab)}
        <button
          type="button"
          onClick={onAddClick}
          aria-label={t('addTransaction')}
          className="flex size-11 items-center justify-center rounded-full text-brand-ink outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <CirclePlus aria-hidden className="size-7" />
        </button>
        {tabs.slice(2).map(tab)}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          className={cn(
            TAB,
            moreActive
              ? 'bg-primary/20 text-brand-ink'
              : 'text-on-surface-variant',
          )}
        >
          <Ellipsis aria-hidden className="size-[22px]" />
          <span className="mt-0.5">{t('more')}</span>
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          closeLabel={tc('close')}
          className="px-4 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        >
          <div className="pr-12">
            <SheetTitle>{t('moreTitle')}</SheetTitle>
            <SheetDescription>{t('moreDescription')}</SheetDescription>
          </div>
          <ul className="flex flex-col gap-1">
            {rest.map(({ entry, section }) => {
              const isActive = entry.href === activeHref;
              const Icon = entry.icon;
              const label =
                section.items.length === 1
                  ? t(`sections.${section.key}`)
                  : t(`items.${entry.key}`);
              return (
                <li key={entry.href}>
                  <Link
                    href={entry.href}
                    onClick={() => setMoreOpen(false)}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex min-h-12 items-center gap-3 rounded-chip px-3 text-base font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50',
                      isActive
                        ? 'bg-primary/15 text-on-background'
                        : 'text-on-surface-variant hover:bg-accent hover:text-on-background',
                    )}
                  >
                    <Icon
                      aria-hidden
                      className={cn('size-5', isActive && 'text-brand-ink')}
                    />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}
