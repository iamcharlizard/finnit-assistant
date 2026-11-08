'use client';

import * as React from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@finnit/ui/components/ui/dropdown-menu';
import { cn } from '@finnit/ui/lib/utils';

/**
 * One filter's dropdown button: its name, then what it holds (a value or a
 * count). Long option lists scroll inside the menu; `action` (e.g.
 * "Deseleccionar todas") sits next to the menu's title.
 */
export function FilterMenu({
  icon: Icon,
  label,
  value,
  count = 0,
  action,
  className,
  children,
}: {
  icon: LucideIcon;
  label: string;
  value?: string | null;
  count?: number;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const on = Boolean(value) || count > 0;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            'shrink-0 gap-1.5 rounded-full',
            on && 'border-brand/40 bg-brand/5',
            className,
          )}
        >
          <Icon aria-hidden />
          <span>{label}</span>
          {value ? (
            <span className="font-normal text-on-surface-variant">
              · {value}
            </span>
          ) : null}
          {count > 0 ? (
            <span className="flex size-5 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-brand-foreground">
              {count}
            </span>
          ) : null}
          <ChevronDown aria-hidden className="text-on-surface-variant" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="flex max-h-[min(26rem,var(--radix-dropdown-menu-content-available-height))] min-w-56 flex-col"
      >
        <div className="flex items-center justify-between gap-2">
          <DropdownMenuLabel>{label}</DropdownMenuLabel>
          {action}
        </div>
        <DropdownMenuSeparator />
        <div className="min-h-0 overflow-y-auto">{children}</div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
