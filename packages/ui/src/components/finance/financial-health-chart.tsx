import { cn } from '../../lib/utils';
import { DonutRing } from './donut-ring';

interface FinancialHealthChartProps {
  percentage?: number;
  label?: string;
  rating?: string;
  caption?: string;
  className?: string;
}

function FinancialHealthChart({
  percentage = 75,
  label = 'Financial health',
  rating = 'Excellent',
  caption = 'Your savings rate is up 5% from last month.',
  className,
}: FinancialHealthChartProps) {
  return (
    <section
      className={cn(
        'flex flex-col items-center rounded-2xl border border-glass-border bg-glass p-5 backdrop-blur-md',
        className,
      )}
    >
      <h3 className="mb-5 self-start text-[15px] font-medium text-on-surface-variant">
        {label}
      </h3>

      <div
        role="progressbar"
        aria-label={`${label}: ${percentage}%`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentage}
        className="relative mb-4 size-[140px]"
      >
        <DonutRing percentage={percentage} />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[26px] leading-8 font-bold text-on-background">
            {percentage}%
          </span>
          <span className="mt-0.5 text-xs text-tertiary">{rating}</span>
        </div>
      </div>

      <p className="px-2 text-center text-[13px] leading-5 text-on-surface-variant">
        {caption}
      </p>
    </section>
  );
}

export { FinancialHealthChart, type FinancialHealthChartProps };
