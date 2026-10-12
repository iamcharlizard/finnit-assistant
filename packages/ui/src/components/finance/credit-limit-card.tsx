import { Gauge } from 'lucide-react';

import { cn } from '../../lib/utils';
import { Progress } from '../ui/progress';

interface CreditLimitCardProps {
  used: number;
  total: number;
  currency?: string;
  locale?: string;
  className?: string;
}

function CreditLimitCard({
  used,
  total,
  currency = 'MXN',
  locale = 'es-MX',
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
        Límite de crédito
      </h3>

      <div>
        <div className="mb-2.5 flex items-end justify-between">
          <span className="text-[28px] font-bold text-tertiary">
            {format(used)}
          </span>
          <span className="text-[13px] text-on-surface-variant">
            de {format(total, true)}
          </span>
        </div>
        <Progress
          value={pct}
          glow
          className="h-2"
          aria-label={`${pct}% del límite utilizado`}
        />
      </div>
    </section>
  );
}

export { CreditLimitCard, type CreditLimitCardProps };
