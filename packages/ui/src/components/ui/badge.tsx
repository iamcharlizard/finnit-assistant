import * as React from 'react';
import { Slot } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide [&>svg]:pointer-events-none [&>svg]:size-3',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        brand:
          'bg-brand text-brand-foreground dark:bg-accent-neon dark:text-secondary-foreground',
        muted: 'bg-track text-on-surface-variant',
        success:
          'bg-green-500/15 text-green-800 dark:bg-green-500/20 dark:text-green-400',
        income: 'bg-income/10 text-income',
        expense: 'bg-expense/10 text-expense',
        highlight: 'bg-highlight/10 text-highlight',
        outline: 'border border-outline text-on-background',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'span';

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
