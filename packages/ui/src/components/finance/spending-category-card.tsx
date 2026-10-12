import type { LucideIcon } from 'lucide-react';

import { cn } from '../../lib/utils';

interface SpendingCategoryCardProps {
  label: string;
  amount: string;
  percent: number;
  icon: LucideIcon;
  accentColor: string;
  className?: string;
}

function SpendingCategoryCard({
  label,
  amount,
  percent,
  icon: Icon,
  accentColor,
  className,
}: SpendingCategoryCardProps) {
  return (
    <div
      className={cn(
        'flex-1 rounded-2xl border border-glass-border bg-glass p-3 backdrop-blur-md',
        className,
      )}
    >
      <span
        className="mb-2 flex size-9 items-center justify-center rounded-[10px]"
        style={{
          backgroundColor: `color-mix(in srgb, ${accentColor} 16%, transparent)`,
        }}
      >
        <Icon
          aria-hidden
          className="size-[18px]"
          style={{ color: accentColor }}
        />
      </span>
      <p className="mb-0.5 truncate text-sm font-bold text-on-background">
        {amount}
      </p>
      <p className="mb-2.5 truncate text-[11px] text-on-surface-variant">
        {label}
      </p>
      <div className="h-1 overflow-hidden rounded-full bg-track">
        <div
          className="h-full rounded-full"
          style={{ width: `${percent}%`, backgroundColor: accentColor }}
        />
      </div>
      <p className="mt-1 text-[10px] text-on-surface-variant">{percent}%</p>
    </div>
  );
}

export { SpendingCategoryCard, type SpendingCategoryCardProps };
