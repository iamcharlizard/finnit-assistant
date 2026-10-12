import * as React from 'react';

import { cn } from '../../lib/utils';

function BalanceCardRoot({
  className,
  ...props
}: React.ComponentProps<'section'>) {
  return (
    <section
      className={cn(
        'rounded-card border border-glass-border bg-glass p-6 shadow-[0_4px_24px_rgba(0,0,0,0.06)] backdrop-blur-md dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)]',
        className,
      )}
      {...props}
    />
  );
}

export { BalanceCardRoot };
