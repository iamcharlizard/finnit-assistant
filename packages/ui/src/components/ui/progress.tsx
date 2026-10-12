'use client';

import * as React from 'react';
import { Progress as ProgressPrimitive } from 'radix-ui';

import { cn } from '../../lib/utils';

interface ProgressProps extends React.ComponentProps<
  typeof ProgressPrimitive.Root
> {
  /** Any CSS color for the filled bar; defaults to the brand accent. */
  indicatorColor?: string;
  glow?: boolean;
}

function Progress({
  className,
  value,
  indicatorColor,
  glow = false,
  ...props
}: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value ?? 0));

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={clamped}
      className={cn(
        'relative h-1.5 w-full overflow-hidden rounded-full bg-track',
        className,
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="h-full rounded-full bg-tertiary transition-all"
        style={{
          width: `${clamped}%`,
          backgroundColor: indicatorColor,
          boxShadow: glow
            ? `0 0 8px ${indicatorColor ?? 'var(--tertiary)'}`
            : undefined,
        }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress, type ProgressProps };
