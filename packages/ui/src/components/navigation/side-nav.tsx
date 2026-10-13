'use client';

import * as React from 'react';
import { Plus, Wallet } from 'lucide-react';

import { cn } from '../../lib/utils';
import type { LinkComponent, NavItem } from './nav-types';

interface SideNavProps {
  items: ReadonlyArray<NavItem>;
  activeHref: string;
  brand?: string;
  onAddClick?: () => void;
  linkComponent?: LinkComponent;
  footer?: React.ReactNode;
  /** Accessible name of the <nav>. */
  navLabel?: string;
  addLabel?: string;
  className?: string;
}

/** Desktop navigation (no mobile equivalent; replaces the bottom bar ≥ lg). */
function SideNav({
  items,
  activeHref,
  brand = 'Finnit',
  onAddClick,
  linkComponent: Link = 'a',
  footer,
  navLabel = 'Main navigation',
  addLabel = 'New transaction',
  className,
}: SideNavProps) {
  return (
    <aside
      className={cn(
        'flex h-full w-64 flex-col gap-6 border-r border-outline bg-surface/80 p-4 backdrop-blur-xl dark:bg-background/80',
        className,
      )}
    >
      <div className="flex items-center gap-3 px-2 pt-2">
        <span className="flex size-10 items-center justify-center rounded-xl bg-accent-neon text-white shadow-[0_4px_20px_rgba(108,114,203,0.35)] dark:text-[#00363a] dark:shadow-[0_0_20px_rgba(0,245,255,0.45)]">
          <Wallet aria-hidden className="size-5" />
        </span>
        <span className="text-title-lg font-bold text-brand-ink">{brand}</span>
      </div>

      <button
        type="button"
        onClick={onAddClick}
        className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <Plus aria-hidden className="size-4" />
        {addLabel}
      </button>

      <nav
        aria-label={navLabel}
        className="flex flex-1 flex-col gap-1"
      >
        {items.map((item) => {
          const isActive = item.href === activeHref;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex min-h-11 items-center gap-3 rounded-chip px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50',
                isActive
                  ? 'bg-primary/15 text-on-background dark:bg-primary/20'
                  : 'text-on-surface-variant hover:bg-accent hover:text-on-background',
              )}
            >
              <Icon
                aria-hidden
                className={cn('size-5', isActive && 'text-brand-ink')}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {footer}
    </aside>
  );
}

export { SideNav, type SideNavProps };
