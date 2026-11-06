import type * as React from 'react';

import type { CapStatus } from '@finnit/core/budgets/status';
import { cn } from '@finnit/ui-native/lib/utils';
import { Text } from '@finnit/ui-native/components/ui/text';

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
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Text weight="medium" className={cn('text-xs', TONES[status], className)}>
      {children}
    </Text>
  );
}
