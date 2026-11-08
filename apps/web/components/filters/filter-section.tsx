'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';

import { cn } from '@finnit/ui/lib/utils';

/**
 * A collapsible group inside a filter panel: its title (with how many
 * values are chosen) toggles the body.
 */
export function FilterSection({
  title,
  count = 0,
  open,
  onToggle,
  children,
}: {
  title: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const bodyId = React.useId();
  return (
    <section className="border-b border-outline-variant last:border-b-0">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={onToggle}
          className="flex min-h-12 w-full items-center gap-2 rounded-lg px-1 text-left text-sm font-medium text-on-background outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <span className="flex-1">{title}</span>
          {count > 0 ? (
            <span className="flex size-5 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-brand-foreground">
              {count}
            </span>
          ) : null}
          <ChevronDown
            aria-hidden
            className={cn(
              'size-4 text-on-surface-variant transition-transform',
              open && 'rotate-180',
            )}
          />
        </button>
      </h3>
      {open ? (
        <div id={bodyId} className="flex flex-col gap-1 pb-3">
          {children}
        </div>
      ) : null}
    </section>
  );
}
