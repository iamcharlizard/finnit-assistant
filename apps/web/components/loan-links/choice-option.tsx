'use client';

import * as React from 'react';
import { Check } from 'lucide-react';

import { cn } from '@finnit/ui/lib/utils';

/**
 * One choice of a radio list (a loan payment, a movement): a check, its
 * title and details, badges and an amount on the right. Put it inside a
 * `role="radiogroup"`.
 */
export function ChoiceOption({
  selected,
  title,
  meta,
  amount,
  badges,
  onSelect,
  disabled = false,
}: {
  selected: boolean;
  title: string;
  meta?: string;
  amount?: string;
  badges?: React.ReactNode;
  onSelect: () => void;
  /** Can't be chosen (shown for context). */
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'flex min-h-11 w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        selected ? 'border-brand bg-brand/5' : 'border-outline hover:bg-track',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'flex size-5 shrink-0 items-center justify-center rounded-full border',
          selected
            ? 'border-brand bg-brand text-brand-foreground'
            : 'border-outline',
        )}
      >
        {selected ? <Check className="size-3.5" /> : null}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-sm font-medium text-on-background">
          {title}
        </span>
        {meta ? (
          <span className="line-clamp-2 text-xs text-on-surface-variant">
            {meta}
          </span>
        ) : null}
        {badges ? (
          <span className="flex flex-wrap gap-1.5">{badges}</span>
        ) : null}
      </span>
      {amount ? (
        <span className="shrink-0 text-sm font-medium text-on-background tabular-nums">
          {amount}
        </span>
      ) : null}
    </button>
  );
}
