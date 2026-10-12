'use client';

import type { LucideIcon } from 'lucide-react';

import { cn } from '../../lib/utils';

interface QuickActionProps {
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
  accessibilityLabel?: string;
  className?: string;
}

function QuickAction({
  label,
  icon: Icon,
  onClick,
  accessibilityLabel,
  className,
}: QuickActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={accessibilityLabel ?? label}
      className={cn(
        'group flex min-h-11 min-w-14 flex-col items-center gap-2 rounded-chip p-1 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        className,
      )}
    >
      <span className="flex size-14 items-center justify-center rounded-full bg-primary/12 transition-colors group-hover:bg-primary/20 dark:bg-primary/20 dark:group-hover:bg-primary/30">
        <Icon aria-hidden className="size-6 text-brand-ink" />
      </span>
      <span className="text-center text-xs text-on-surface-variant">
        {label}
      </span>
    </button>
  );
}

export { QuickAction, type QuickActionProps };
