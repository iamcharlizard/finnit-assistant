import { cn } from '../../lib/utils';

interface BalanceCardHeaderProps {
  label?: string;
  amount: string;
  trend?: string;
  trendPositive?: boolean;
  className?: string;
}

function BalanceCardHeader({
  label = 'Balance total',
  amount,
  trend,
  trendPositive = true,
  className,
}: BalanceCardHeaderProps) {
  return (
    <div className={cn('mb-4', className)}>
      <p className="mb-1 text-label-sm font-medium uppercase tracking-widest text-on-surface-variant">
        {label}
      </p>
      <p className="text-display-lg font-bold text-on-background">{amount}</p>
      {trend ? (
        <p className="mt-1 flex items-center gap-1">
          <span
            className={cn(
              'text-sm font-medium',
              trendPositive ? 'text-income' : 'text-expense',
            )}
          >
            {trend}
          </span>
          <span className="text-xs text-on-surface-variant">este mes</span>
        </p>
      ) : null}
    </div>
  );
}

export { BalanceCardHeader, type BalanceCardHeaderProps };
