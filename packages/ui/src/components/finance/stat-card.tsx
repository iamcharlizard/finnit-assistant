import { CircleArrowDown, CircleArrowUp } from 'lucide-react';

import { cn } from '../../lib/utils';

interface StatCardProps {
  variant: 'income' | 'expense';
  label: string;
  amount: string;
  className?: string;
}

function StatCard({ variant, label, amount, className }: StatCardProps) {
  const isIncome = variant === 'income';
  const Icon = isIncome ? CircleArrowDown : CircleArrowUp;

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-card p-5',
        isIncome
          ? 'bg-[#006688] text-white shadow-[0_4px_20px_rgba(0,102,136,0.28)]'
          : 'border border-glass-border bg-track',
        className,
      )}
    >
      <div className="min-w-0">
        <p
          className={cn(
            'mb-1.5 text-[11px] font-medium uppercase tracking-widest',
            isIncome ? 'text-white/80' : 'text-on-surface-variant',
          )}
        >
          {label}
        </p>
        <p
          className={cn(
            'text-title-lg font-bold',
            isIncome ? 'text-white' : 'text-on-background',
          )}
        >
          {amount}
        </p>
      </div>
      <div
        className={cn(
          'flex size-12 shrink-0 items-center justify-center rounded-full',
          isIncome ? 'bg-white/20' : 'bg-expense/10',
        )}
      >
        <Icon
          aria-hidden
          className={cn('size-5', isIncome ? 'text-white' : 'text-expense')}
        />
      </div>
    </div>
  );
}

export { StatCard, type StatCardProps };
