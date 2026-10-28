import { ChartColumn } from 'lucide-react';

import { cn } from '../../lib/utils';
import { Progress } from '../ui/progress';

interface MonthlyBudgetCardProps {
  title?: string;
  /** Integer part, e.g. "$2,480". */
  amount: string;
  /** Decimal part, e.g. ".50". */
  cents?: string;
  usedPercent: number;
  /** Caption under the bar (also the bar's accessible name). */
  usedLabel?: (percent: number) => string;
  className?: string;
}

function MonthlyBudgetCard({
  title = 'Monthly spending',
  amount,
  cents,
  usedPercent,
  usedLabel = (percent) => `You've used ${percent}% of your budget.`,
  className,
}: MonthlyBudgetCardProps) {
  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-card border border-glass-border bg-glass p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] backdrop-blur-md',
        className,
      )}
    >
      <ChartColumn
        aria-hidden
        className="pointer-events-none absolute top-4 right-4 size-20 text-on-surface-variant opacity-[0.07]"
      />
      <h3 className="mb-3 text-base font-medium text-tertiary">{title}</h3>
      <p className="mb-3 flex items-end gap-1">
        <span className="text-[40px] leading-[48px] font-bold text-on-background">
          {amount}
        </span>
        {cents ? (
          <span className="mb-1 text-xl text-on-surface-variant">{cents}</span>
        ) : null}
      </p>
      <Progress
        value={usedPercent}
        glow
        indicatorColor="var(--income)"
        className="mb-2.5"
        aria-label={usedLabel(usedPercent)}
      />
      <p className="text-[13px] text-on-surface-variant">
        {usedLabel(usedPercent)}
      </p>
    </section>
  );
}

export { MonthlyBudgetCard, type MonthlyBudgetCardProps };
