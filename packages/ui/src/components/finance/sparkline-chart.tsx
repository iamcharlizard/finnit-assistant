import * as React from 'react';

import { cn } from '../../lib/utils';

interface SparklineChartProps {
  /** SVG path in a 400×80 viewBox. Defaults to the dashboard S-curve. */
  path?: string;
  color?: string;
  className?: string;
}

const DEFAULT_PATH = 'M0,60 Q50,52 100,65 T200,28 T300,45 T400,8';

/** Decorative neon line chart used inside BalanceCard.Chart. */
function SparklineChart({
  path = DEFAULT_PATH,
  color = 'var(--accent-neon)',
  className,
}: SparklineChartProps) {
  const id = React.useId().replace(/:/g, '');

  return (
    <svg
      viewBox="0 0 400 80"
      preserveAspectRatio="none"
      aria-hidden
      className={cn('size-full', className)}
    >
      <defs>
        <linearGradient id={`line-${id}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={color} stopOpacity="0.2" />
          <stop offset=".5" stopColor={color} stopOpacity="1" />
          <stop offset="1" stopColor={color} stopOpacity="0.5" />
        </linearGradient>
        <filter id={`glow-${id}`}>
          <feGaussianBlur stdDeviation="2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path
        d={path}
        fill="none"
        stroke={`url(#line-${id})`}
        strokeWidth="3"
        filter={`url(#glow-${id})`}
      />
      <path d={`${path} L400,80 L0,80 Z`} fill={color} fillOpacity="0.06" />
    </svg>
  );
}

export { SparklineChart, type SparklineChartProps };
