import * as React from 'react';

import { cn } from '../../lib/utils';

function BalanceCardChart({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      aria-hidden
      className={cn('h-20 overflow-hidden rounded-chip bg-track', className)}
      {...props}
    />
  );
}

export { BalanceCardChart };
