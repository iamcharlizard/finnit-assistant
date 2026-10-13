import { ArrowUpRight, ChartLine } from 'lucide-react';

import { cn } from '../../lib/utils';

interface MonthlySpendingCardProps {
  title?: string;
  amount: string;
  trendLabel: string;
  sparkHeights?: number[];
  className?: string;
}

function MonthlySpendingCard({
  title = 'Spending this month',
  amount,
  trendLabel,
  sparkHeights = [40, 60, 50, 80, 100],
  className,
}: MonthlySpendingCardProps) {
  const last = sparkHeights.length - 1;

  return (
    <section
      className={cn(
        'flex min-h-44 flex-col justify-between rounded-[20px] border border-glass-border bg-glass p-[18px] backdrop-blur-md',
        className,
      )}
    >
      <h3 className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.15em] text-on-surface-variant">
        <ChartLine aria-hidden className="size-[18px] text-highlight" />
        {title}
      </h3>

      <div>
        <p className="mb-2.5 text-[28px] font-bold text-on-background">
          {amount}
        </p>
        <div className="flex items-end justify-between">
          <span className="flex items-center gap-1 text-[13px] text-highlight">
            <ArrowUpRight aria-hidden className="size-3.5" />
            {trendLabel}
          </span>
          <span aria-hidden className="flex h-10 items-end gap-[3px]">
            {sparkHeights.map((h, i) => (
              <span
                key={i}
                className={cn(
                  'w-2 rounded-t-[2px] bg-highlight',
                  i === last && 'shadow-[0_0_8px_var(--highlight)]',
                )}
                style={{
                  height: h * 0.4,
                  opacity: 0.18 + (i / Math.max(1, last)) * 0.82,
                }}
              />
            ))}
          </span>
        </div>
      </div>
    </section>
  );
}

export { MonthlySpendingCard, type MonthlySpendingCardProps };
