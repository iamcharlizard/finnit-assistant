import type { ReactNode } from 'react';

import { cn } from '@finnit/ui/lib/utils';

import type { CapStatus } from '@/lib/budgets/status';

const TONES: Record<CapStatus, string> = {
  ok: 'text-on-surface-variant',
  warning: 'text-amber-700 dark:text-amber-400',
  over: 'text-expense',
};

/** A line of text in the color of a usage status. */
export function StatusText({
  status,
  children,
  className,
}: {
  status: CapStatus;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn('text-xs font-medium', TONES[status], className)}>
      {children}
    </span>
  );
}
