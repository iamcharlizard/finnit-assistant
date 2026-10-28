'use client';

import { CirclePlus } from 'lucide-react';

import { cn } from '../../lib/utils';
import type { LinkComponent, NavItem } from './nav-types';

interface BottomNavBarProps {
  items: ReadonlyArray<NavItem>;
  activeHref: string;
  /** Center "add" action (mobile opens the add-transaction flow). */
  onAddClick?: () => void;
  linkComponent?: LinkComponent;
  /** Accessible name of the <nav>. */
  navLabel?: string;
  /** Accessible name of the center add button. */
  addLabel?: string;
  className?: string;
}

function BottomNavBar({
  items,
  activeHref,
  onAddClick,
  linkComponent: Link = 'a',
  navLabel = 'Main navigation',
  addLabel = 'Add transaction',
  className,
}: BottomNavBarProps) {
  const middle = Math.ceil(items.length / 2);

  const renderItem = (item: NavItem) => {
    const isActive = item.href === activeHref;
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          'flex min-h-11 min-w-11 flex-col items-center justify-center rounded-chip px-3 py-1 text-[10px] font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
          isActive ? 'bg-primary/20 text-brand-ink' : 'text-on-surface-variant',
        )}
      >
        <Icon aria-hidden className="size-[22px]" />
        <span className="mt-0.5">{item.label}</span>
      </Link>
    );
  };

  return (
    <nav
      aria-label={navLabel}
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-outline bg-surface/92 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-2px_16px_rgba(0,0,0,0.06)] backdrop-blur-xl dark:bg-background/92 dark:shadow-[0_-2px_16px_rgba(0,0,0,0.3)]',
        className,
      )}
    >
      {items.slice(0, middle).map(renderItem)}
      <button
        type="button"
        onClick={onAddClick}
        aria-label={addLabel}
        className="flex size-11 items-center justify-center rounded-full text-brand-ink outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <CirclePlus aria-hidden className="size-7" />
      </button>
      {items.slice(middle).map(renderItem)}
    </nav>
  );
}

export { BottomNavBar, type BottomNavBarProps };
