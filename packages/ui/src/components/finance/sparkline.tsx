import * as React from 'react';

import { cn } from '../../lib/utils';

interface SparklineProps {
  /** Oldest first; fewer than two values draw nothing. */
  values: ReadonlyArray<number>;
  /** Line color, e.g. `var(--chart-1)`. */
  color: string;
  className?: string;
}

const WIDTH = 100;
const HEIGHT = 40;
/** Room so the 2px line isn't cut at the top and bottom. */
const PAD = 3;

/**
 * A tiny trend line with a soft area under it (decorative: the figure next
 * to it carries the meaning, so it is hidden from screen readers). It
 * stretches to its box; the line keeps its width.
 */
function Sparkline({ values, color, className }: SparklineProps) {
  const id = React.useId();
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((value, i) => {
    const x = (i / (values.length - 1)) * WIDTH;
    // A flat series sits in the middle.
    const y =
      max === min
        ? HEIGHT / 2
        : PAD + (1 - (value - min) / span) * (HEIGHT - PAD * 2);
    return [x, y] as const;
  });
  const line = points
    .map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(' ');
  const area = `${line} L${WIDTH} ${HEIGHT} L0 ${HEIGHT} Z`;

  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      className={cn('block h-10 w-24 overflow-visible', className)}
    >
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.28} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export { Sparkline, type SparklineProps };
