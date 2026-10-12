import * as React from 'react';

import { cn } from '../../lib/utils';

function BalanceCardFooter({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('mt-4 flex items-center justify-between pt-4', className)}
      {...props}
    />
  );
}

export { BalanceCardFooter };
