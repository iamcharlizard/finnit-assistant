import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

import { cn } from '../../lib/utils';

interface SparkBar {
  heightPercent: number;
  highlighted?: boolean;
}

interface AnalyticsHeroCardProps {
  label?: string;
  amount: string;
  /** The trend badge is only rendered when given. */
  trendPercent?: string;
  trendDown?: boolean;
  sparkBars?: SparkBar[];
  /** Screen-reader words before the trend percentage. */
  trendDownLabel?: string;
  trendUpLabel?: string;
  className?: string;
}

const DEFAULT_BARS: SparkBar[] = [
  { heightPercent: 40 },
  { heightPercent: 60 },
  { heightPercent: 45 },
  { heightPercent: 70 },
  { heightPercent: 85, highlighted: true },
  { heightPercent: 50 },
  { heightPercent: 30 },
];

function AnalyticsHeroCard({
  label = 'Total spending',
  amount,
  trendPercent,
  trendDown = true,
  sparkBars = DEFAULT_BARS,
  trendDownLabel = 'Down',
  trendUpLabel = 'Up',
  className,
}: AnalyticsHeroCardProps) {
  const TrendIcon = trendDown ? ArrowDownRight : ArrowUpRight;

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-2xl border border-glass-border bg-glass p-5 backdrop-blur-md',
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-8 -right-8 size-24 rounded-full bg-[#6c72cb]/15 blur-xl"
      />

      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="mb-1 text-[13px] text-on-surface-variant">{label}</p>
          <p className="text-[32px] leading-10 font-bold text-on-background">
            {amount}
          </p>
        </div>
        {trendPercent ? (
          <span className="flex items-center gap-1 rounded-lg bg-tertiary/12 px-2 py-1 text-[13px] font-bold text-tertiary">
            <TrendIcon aria-hidden className="size-3" />
            <span className="sr-only">{trendDown ? trendDownLabel : trendUpLabel}</span>
            {trendPercent}
          </span>
        ) : null}
      </div>

      <div aria-hidden className="flex h-16 items-end gap-1">
        {sparkBars.map((bar, i) => (
          <div
            key={i}
            className={cn(
              'flex-1 rounded-t-[3px]',
              bar.highlighted
                ? 'bg-[#6c72cb]/55 shadow-[0_0_8px_rgba(191,194,255,0.35)]'
                : 'bg-[#6c72cb]/22',
            )}
            style={{ height: `${bar.heightPercent}%` }}
          />
        ))}
      </div>
    </section>
  );
}

export { AnalyticsHeroCard, type AnalyticsHeroCardProps, type SparkBar };
