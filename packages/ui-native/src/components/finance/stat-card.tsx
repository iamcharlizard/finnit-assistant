import { CircleArrowDown, CircleArrowUp } from 'lucide-react-native';

import { cn } from '../../lib/utils';
import { TwView } from '../../lib/tw';
import { Icon } from '../ui/icon';
import { Text } from '../ui/text';

interface StatCardProps {
  variant: 'income' | 'expense';
  label: string;
  amount: string;
  className?: string;
}

/** A month's income (solid) or expenses (quiet), like @finnit/ui's StatCard. */
function StatCard({ variant, label, amount, className }: StatCardProps) {
  const income = variant === 'income';
  return (
    <TwView
      className={cn(
        'flex-row items-center justify-between gap-3 rounded-card p-5',
        income ? 'bg-[#006688]' : 'border border-glass-border bg-track',
        className,
      )}
      style={income ? { boxShadow: '0 4px 20px rgba(0,102,136,0.28)' } : undefined}
    >
      <TwView className="min-w-0 flex-1">
        <Text
          weight="medium"
          numberOfLines={1}
          className={cn('mb-1.5 text-[11px] uppercase tracking-widest', income ? 'text-[rgba(255,255,255,0.8)]' : 'text-on-surface-variant')}
        >
          {label}
        </Text>
        <Text
          weight="bold"
          numberOfLines={1}
          adjustsFontSizeToFit
          className={cn('text-title-lg', income ? 'text-white' : 'text-on-background')}
        >
          {amount}
        </Text>
      </TwView>
      <TwView
        className={cn(
          'size-12 shrink-0 items-center justify-center rounded-full',
          income ? 'bg-[rgba(255,255,255,0.2)]' : 'bg-expense-10',
        )}
      >
        {income ? (
          <CircleArrowDown size={20} color="#ffffff" />
        ) : (
          <Icon icon={CircleArrowUp} size={20} color="--expense" />
        )}
      </TwView>
    </TwView>
  );
}

export { StatCard, type StatCardProps };
