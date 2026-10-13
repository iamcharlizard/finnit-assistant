import { Gauge } from 'lucide-react';

import { cn } from '../../lib/utils';
import { Progress } from '../ui/progress';

interface CreditLimitCardProps {
  used: number;
  total: number;
  currency?: string;
  locale?: string;
  title?: string;
  /** Text next to the total; receives the formatted total. */
  ofLabel?: (total: string) => string;
  /** Accessible name of the progress bar; receives the used percentage. */
  progressLabel?: (percent: number) => string;
  className?: string;
}

function CreditLimitCard({
  used,
  total,
  currency = 'MXN',
  locale = 'es-MX',
  title = 'Credit limit',
  ofLabel = (total) => `of ${total}`,
  progressLabel = (percent) => `${percent}% of the limit used`,
  className,
}: CreditLimitCardProps) {
  const pct = Math.round((used / total) * 100);
  // Compact notation differs between Node's and browsers' ICU data, which
  // breaks SSR hydration, so the total uses whole units instead.
  const format = (n: number, wholeUnits = false) =>
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: wholeUnits ? 0 : 2,
    }).format(n);

  return (
    <section
      className={cn(
        'flex min-h-44 flex-col justify-between rounded-[20px] border border-glass-border bg-glass p-[18px] backdrop-blur-md',
        className,
      )}
    >
      <h3 className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.15em] text-on-surface-variant">
        <Gauge aria-hidden className="size-[18px] text-tertiary" />
        {title}
      </h3>

      <div>
        <div className="mb-2.5 flex items-end justify-between">
          <span className="text-[28px] font-bold text-tertiary">
            {format(used)}
          </span>
          <span className="text-[13px] text-on-surface-variant">
            {ofLabel(format(total, true))}
          </span>
        </div>
        <Progress
          value={pct}
          glow
          className="h-2"
          aria-label={progressLabel(pct)}
        />
      </div>
    </section>
  );
}

export { CreditLimitCard, type CreditLimitCardProps };
