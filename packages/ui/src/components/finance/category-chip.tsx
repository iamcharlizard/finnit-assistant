'use client';

import type { LucideIcon } from 'lucide-react';

import { cn } from '../../lib/utils';

interface CategoryChipProps {
  label: string;
  icon: LucideIcon;
  accentColor: string;
  onClick?: () => void;
  className?: string;
}

function CategoryChip({
  label,
  icon: Icon,
  accentColor,
  onClick,
  className,
}: CategoryChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-28 flex-col items-center gap-3 rounded-2xl border border-glass-border bg-glass px-2 py-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)] outline-none backdrop-blur-md transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50',
        className,
      )}
    >
      <span
        className="flex size-10 items-center justify-center rounded-full"
        style={{
          backgroundColor: `color-mix(in srgb, ${accentColor} 10%, transparent)`,
        }}
      >
        <Icon aria-hidden className="size-5" style={{ color: accentColor }} />
      </span>
      <span className="text-center text-xs text-on-surface-variant">
        {label}
      </span>
    </button>
  );
}

export { CategoryChip, type CategoryChipProps };
