import * as React from 'react';
import { Slot } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/utils';

const buttonVariants = cva(
  "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-button text-sm font-medium transition-all outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 active:opacity-75',
        secondary:
          'bg-accent-neon text-secondary-foreground shadow-xs hover:bg-accent-neon/90 active:opacity-75',
        ghost: 'text-brand-ink hover:bg-accent active:opacity-75',
        outline:
          'border border-outline bg-transparent text-on-background hover:bg-accent active:opacity-75',
        destructive:
          'border border-expense/30 bg-expense/10 text-expense hover:bg-expense/15',
        link: 'min-h-0 text-brand-ink underline-offset-4 hover:underline',
      },
      size: {
        default: 'px-6 py-3',
        sm: 'min-h-9 px-4 py-2 text-xs',
        lg: 'min-h-14 px-8 text-base',
        icon: 'size-11',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  },
);

interface ButtonProps
  extends React.ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  /** Mirrors the mobile `label` prop; `children` takes precedence. */
  label?: string;
  asChild?: boolean;
}

function Button({
  className,
  variant,
  size,
  asChild = false,
  label,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button';

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {children ?? label}
    </Comp>
  );
}

export { Button, buttonVariants, type ButtonProps };
