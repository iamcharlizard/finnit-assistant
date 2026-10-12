import * as React from 'react';

import { cn } from '../../lib/utils';

/** Web equivalent of the mobile `FinnGlassView`: a blurred, translucent surface. */
function GlassCard({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="glass-card"
      className={cn(
        'rounded-card border border-glass-border bg-glass backdrop-blur-xl',
        className,
      )}
      {...props}
    />
  );
}

export { GlassCard };
