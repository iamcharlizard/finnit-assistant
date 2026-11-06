import { cn } from '../../lib/utils';
import { TwView } from '../../lib/tw';
import { Text } from './text';

type BadgeVariant =
  | 'default'
  | 'brand'
  | 'muted'
  | 'success'
  | 'income'
  | 'expense'
  | 'highlight'
  | 'outline';

const VARIANT: Record<BadgeVariant, { box: string; text: string }> = {
  default: { box: 'bg-primary', text: 'text-primary-foreground' },
  brand: {
    box: 'bg-brand dark:bg-accent-neon',
    text: 'text-brand-foreground dark:text-secondary-foreground',
  },
  muted: { box: 'bg-track', text: 'text-on-surface-variant' },
  success: {
    box: 'bg-[rgba(34,197,94,0.15)] dark:bg-[rgba(34,197,94,0.2)]',
    text: 'text-green-800 dark:text-green-400',
  },
  income: { box: 'bg-income-10', text: 'text-income' },
  expense: { box: 'bg-expense-10', text: 'text-expense' },
  highlight: { box: 'bg-highlight-10', text: 'text-highlight' },
  outline: { box: 'border border-outline', text: 'text-on-background' },
};

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  className?: string;
}

function Badge({ label, variant = 'default', className }: BadgeProps) {
  return (
    <TwView
      className={cn(
        'shrink-0 self-start flex-row items-center rounded-full px-2 py-0.5',
        VARIANT[variant].box,
        className,
      )}
    >
      <Text
        weight="bold"
        className={cn('text-[10px] uppercase tracking-wide', VARIANT[variant].text)}
      >
        {label}
      </Text>
    </TwView>
  );
}

export { Badge, type BadgeProps, type BadgeVariant };
