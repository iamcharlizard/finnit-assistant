import type * as React from 'react';
import { ArrowDown, ArrowRight, ArrowUp, type LucideIcon } from 'lucide-react';

import { cn } from '../../lib/utils';
import { Sparkline } from './sparkline';

interface StatTileTrend {
  /** "+12.5%". */
  label: string;
  direction: 'up' | 'down' | 'flat';
  /** Good news (income color), bad news (expense color) or neither. */
  tone: 'positive' | 'negative' | 'neutral';
}

interface StatTileProps {
  icon: LucideIcon;
  /** The tile's accent (icon and chart), e.g. `var(--chart-1)`. */
  color: string;
  label: string;
  value: string;
  trend?: StatTileTrend | null;
  /** Next to the trend, e.g. "vs mes anterior". */
  compareLabel?: string | null;
  /** Instead of a trend, e.g. "2 próximos". */
  caption?: string | null;
  /** Mini chart, oldest first. */
  spark?: ReadonlyArray<number>;
  /** E.g. an InfoHint next to the label. */
  hint?: React.ReactNode;
  /** Screen-reader text for the trend ("Subió 12.5% vs mes anterior"). */
  trendLabel?: string;
  className?: string;
}

const TREND_ICON = { up: ArrowUp, down: ArrowDown, flat: ArrowRight };
const TONE_CLASS = {
  positive: 'text-income',
  negative: 'text-expense',
  neutral: 'text-on-surface-variant',
};

/**
 * One analytics figure: a tinted icon, the label, the amount, how it
 * changed (arrow, percentage and against what) and a mini trend chart.
 */
function StatTile({
  icon: Icon,
  color,
  label,
  value,
  trend,
  compareLabel,
  caption,
  spark = [],
  hint,
  trendLabel,
  className,
}: StatTileProps) {
  const TrendIcon = trend ? TREND_ICON[trend.direction] : null;
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-3 rounded-card border border-outline-variant bg-surface p-4 shadow-sm',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          aria-hidden
          className="flex size-11 shrink-0 items-center justify-center rounded-2xl"
          style={{
            backgroundColor: `color-mix(in oklab, ${color} 16%, transparent)`,
            color,
          }}
        >
          <Icon className="size-5" />
        </span>
        <Sparkline values={spark} color={color} className="h-10 w-20" />
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="flex items-center gap-1 text-sm text-on-surface-variant">
          <span className="truncate">{label}</span>
          {hint}
        </p>
        <p className="truncate text-2xl font-bold text-on-background tabular-nums">
          {value}
        </p>
      </div>
      <p className="flex min-h-5 flex-wrap items-center gap-x-2 text-xs">
        {trend && TrendIcon ? (
          <>
            <span
              className={cn(
                'inline-flex items-center gap-0.5 font-semibold tabular-nums',
                TONE_CLASS[trend.tone],
              )}
            >
              <TrendIcon aria-hidden className="size-3.5" />
              <span aria-hidden>{trend.label}</span>
              {trendLabel ? (
                <span className="sr-only">{trendLabel}</span>
              ) : null}
            </span>
            {compareLabel ? (
              <span aria-hidden className="text-on-surface-variant">
                {compareLabel}
              </span>
            ) : null}
          </>
        ) : caption ? (
          <span className="font-medium text-on-surface-variant">{caption}</span>
        ) : null}
      </p>
    </div>
  );
}

export { StatTile, type StatTileProps, type StatTileTrend };
