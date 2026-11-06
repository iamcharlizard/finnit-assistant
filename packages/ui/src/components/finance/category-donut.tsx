import * as React from 'react';

import { cn } from '../../lib/utils';

interface DonutSlice {
  id: string;
  label: string;
  /** Share of the whole, 0–100. */
  percent: number;
  /** Formatted amount ("$1,250.00"). */
  amount: string;
  /** Formatted share ("32%"). */
  percentage: string;
  color: string;
}

interface CategoryDonutProps {
  slices: ReadonlyArray<DonutSlice>;
  /** What the center says with nothing hovered ("Gastado"). */
  totalLabel: string;
  /** The formatted total. */
  total: string;
  /** Read by screen readers instead of the drawing (the legend is visible text). */
  summary: string;
  size?: number;
  className?: string;
}

const STROKE = 18;
/** Surface gap between slices, in px along the ring. */
const GAP = 2;

/**
 * A donut of shares (e.g. spending by category) with its legend: each slice
 * in its color with a small gap, the total in the center, and the hovered
 * or focused slice's name, amount and share there instead. The legend
 * lists every slice with its amount and share, so color is never the only
 * cue.
 */
function CategoryDonut({
  slices,
  totalLabel,
  total,
  summary,
  size = 168,
  className,
}: CategoryDonutProps) {
  const [active, setActive] = React.useState<string | null>(null);
  const radius = (size - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const shown = slices.find((s) => s.id === active) ?? null;
  const gap = slices.length > 1 ? GAP : 0;

  let offset = 0;
  const arcs = slices.map((slice) => {
    const length = (slice.percent / 100) * circumference;
    const arc = {
      slice,
      dash: Math.max(0, length - gap),
      offset,
    };
    offset += length;
    return arc;
  });

  return (
    <div className={cn('flex flex-col items-center gap-5', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={summary}
          className="-rotate-90"
        >
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--track)"
            strokeWidth={STROKE}
          />
          {arcs.map(({ slice, dash, offset: start }) => (
            <circle
              key={slice.id}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={slice.color}
              strokeWidth={active === slice.id ? STROKE + 4 : STROKE}
              strokeDasharray={`${dash} ${circumference}`}
              strokeDashoffset={-start}
              className="cursor-pointer transition-[stroke-width,opacity] duration-150"
              opacity={active && active !== slice.id ? 0.45 : 1}
              onPointerEnter={() => setActive(slice.id)}
              onPointerLeave={() => setActive(null)}
            />
          ))}
        </svg>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center"
        >
          <span className="line-clamp-2 text-xs text-on-surface-variant">
            {shown ? shown.label : totalLabel}
          </span>
          <span className="text-base font-bold text-on-background tabular-nums">
            {shown ? shown.amount : total}
          </span>
          {shown ? (
            <span className="text-xs font-medium text-on-surface-variant tabular-nums">
              {shown.percentage}
            </span>
          ) : null}
        </div>
      </div>

      <ul className="flex w-full flex-col gap-1">
        {slices.map((slice) => (
          <li key={slice.id}>
            <button
              type="button"
              onPointerEnter={() => setActive(slice.id)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(slice.id)}
              onBlur={() => setActive(null)}
              className={cn(
                'flex min-h-9 w-full items-center gap-3 rounded-lg px-2 text-left text-sm outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50',
                active === slice.id ? 'bg-track' : 'hover:bg-track/60',
              )}
            >
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: slice.color }}
              />
              <span className="min-w-0 flex-1 truncate text-on-background">
                {slice.label}
              </span>
              <span className="text-xs text-on-surface-variant tabular-nums">
                {slice.amount}
              </span>
              <span className="w-10 text-right text-xs font-medium text-on-surface-variant tabular-nums">
                {slice.percentage}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export { CategoryDonut, type CategoryDonutProps, type DonutSlice };
