import * as React from 'react';

import type { AnalyticsView } from '@/lib/analytics/view';

const WIDTH = 400;
const HEIGHT = 110;

/** SVG path through the projected balances, scaled to the box. */
function linePath(values: number[]): string {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = values.length > 1 ? WIDTH / (values.length - 1) : 0;
  return values
    .map((v, i) => {
      const x = Math.round(i * step);
      const y = Math.round(HEIGHT - 8 - ((v - min) / span) * (HEIGHT - 16));
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    })
    .join(' ');
}

/** Projected total balance for the next months. */
export function CashFlowProjection({
  points,
}: {
  points: AnalyticsView['projection'];
}) {
  const id = React.useId().replace(/:/g, '');
  if (points.length === 0) return null;
  const path = linePath(points.map((p) => p.value));
  const last = points[points.length - 1]!;

  return (
    <section className="overflow-hidden rounded-2xl border border-glass-border bg-glass p-5 backdrop-blur-md">
      <h3 className="mb-1 text-lg font-bold text-on-background">
        Proyección de saldo
      </h3>
      <p className="mb-4 text-[13px] text-on-surface-variant">
        Con tu promedio mensual de ingresos y gastos, en {last.label} tendrías{' '}
        <strong className="text-on-background">{last.balance}</strong>.
      </p>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        aria-hidden
        className="h-[110px] w-full"
      >
        <defs>
          <linearGradient id={`a-${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--tertiary)" stopOpacity="0.15" />
            <stop offset="1" stopColor="var(--tertiary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={`${path} L${WIDTH},${HEIGHT} L0,${HEIGHT} Z`}
          fill={`url(#a-${id})`}
        />
        <path
          d={path}
          fill="none"
          stroke="var(--tertiary)"
          strokeWidth="2.5"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <dl className="mt-3 grid grid-cols-3 gap-x-2 gap-y-2 sm:grid-cols-6">
        {points.map((p) => (
          <div key={p.label}>
            <dt className="text-[11px] text-on-surface-variant">{p.label}</dt>
            <dd className="truncate text-xs font-medium text-on-background">
              {p.balance}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
