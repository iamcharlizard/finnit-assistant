'use client';

import type { LucideIcon } from 'lucide-react';

import { cn } from '../../lib/utils';

interface CategoryProgressItemProps {
  label: string;
  amount: string;
  progressPercent: number;
  icon: LucideIcon;
  accentColor: string;
  onClick?: () => void;
  className?: string;
}

function CategoryProgressItem({
  label,
  amount,
  progressPercent,
  icon: Icon,
  accentColor,
  onClick,
  className,
}: CategoryProgressItemProps) {
  const clamped = Math.min(100, Math.max(0, progressPercent));

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-11 w-full items-center gap-4 rounded-2xl border border-glass-border bg-glass p-4 text-left outline-none backdrop-blur-md transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50',
        className,
      )}
    >
      <span
        className="flex size-12 shrink-0 items-center justify-center rounded-full border"
        style={{
          backgroundColor: `color-mix(in srgb, ${accentColor} 12%, transparent)`,
          borderColor: `color-mix(in srgb, ${accentColor} 20%, transparent)`,
        }}
      >
        <Icon
          aria-hidden
          className="size-[22px]"
          style={{ color: accentColor }}
        />
      </span>
      <span className="flex-1">
        <span className="mb-2 flex justify-between text-[15px] text-on-background">
          <span className="font-medium">{label}</span>
          <span className="font-bold">{amount}</span>
        </span>
        <span className="block h-[5px] w-full overflow-hidden rounded-full bg-track">
          <span
            className="block h-full rounded-full"
            style={{ width: `${clamped}%`, backgroundColor: accentColor }}
          />
        </span>
      </span>
    </button>
  );
}

export { CategoryProgressItem, type CategoryProgressItemProps };
