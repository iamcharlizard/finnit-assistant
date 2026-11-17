'use client';

import * as React from 'react';

import { cn } from '@finnit/ui/lib/utils';

import { donutPaths, type PieSlice } from '@finnit/core/finance/pie';
import { ChartCard } from '@/components/calendar/chart-card';
import { ChartTable } from '@/components/debts/insights/chart-table';

const SIZE = 168;
const THICKNESS = 30;

/**
 * A donut ("pastel") with the total in the middle and a legend that names
 * every slice with its amount and share (identity is never color alone).
 * Hovering or focusing a slice or its legend row highlights it; the
 * numbers are also a table.
 */
export function DonutChart({
  title,
  hint,
  slices,
  centerLabel,
  centerValue,
  labels,
}: {
  title: string;
  hint?: string;
  slices: PieSlice[];
  /** Under the total in the middle ("al mes"). */
  centerLabel: string;
  centerValue: string;
  labels: {
    /** "4 pagos" */
    count: (count: number) => string;
    /** First column of the table ("Categoría"). */
    column: string;
    total: string;
    seeTable: string;
    empty: string;
  };
}) {
  const [active, setActive] = React.useState<string | null>(null);
  const paths = donutPaths(
    slices.map((s) => s.value),
    { size: SIZE, thickness: THICKNESS },
  );
  const shown = slices.find((s) => s.key === active);

  return (
    <ChartCard title={title} hint={hint}>
      {slices.length === 0 ? (
        <p className="text-sm text-on-surface-variant">{labels.empty}</p>
      ) : (
        <div className="@container flex flex-col gap-3">
          <div className="flex flex-col items-center gap-5 @md:flex-row @md:items-center">
            <div
              className="relative shrink-0"
              style={{ width: SIZE, height: SIZE }}
            >
              <svg
                width={SIZE}
                height={SIZE}
                viewBox={`0 0 ${SIZE} ${SIZE}`}
                role="img"
                aria-label={`${title}: ${slices
                  .map((s) => `${s.label} ${s.amount} (${s.percent}%)`)
                  .join(', ')}`}
                onPointerLeave={() => setActive(null)}
              >
                {slices.map((slice, i) => (
                  <path
                    key={slice.key}
                    d={paths[i]}
                    fill={slice.color}
                    // A 2px gap of the card's surface between slices.
                    stroke="var(--surface)"
                    strokeWidth={2}
                    strokeLinejoin="round"
                    opacity={active && active !== slice.key ? 0.35 : 1}
                    onPointerEnter={() => setActive(slice.key)}
                    className="transition-opacity"
                  />
                ))}
              </svg>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
                <span className="text-base font-bold text-on-background tabular-nums">
                  {shown ? shown.amount : centerValue}
                </span>
                <span className="line-clamp-2 text-[11px] text-on-surface-variant">
                  {shown ? `${shown.label} · ${shown.percent}%` : centerLabel}
                </span>
              </div>
            </div>
            <ul className="flex w-full min-w-0 flex-col gap-1">
              {slices.map((slice) => (
                <li key={slice.key}>
                  <button
                    type="button"
                    onPointerEnter={() => setActive(slice.key)}
                    onPointerLeave={() => setActive(null)}
                    onFocus={() => setActive(slice.key)}
                    onBlur={() => setActive(null)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50',
                      active === slice.key && 'bg-track',
                    )}
                  >
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: slice.color }}
                    />
                    <span className="min-w-0 flex-1 truncate text-on-background">
                      {slice.label}
                      <span className="ml-1.5 text-on-surface-variant">
                        {labels.count(slice.count)}
                      </span>
                    </span>
                    <span className="shrink-0 font-medium text-on-background tabular-nums">
                      {slice.amount}
                    </span>
                    <span className="w-10 shrink-0 text-right text-on-surface-variant tabular-nums">
                      {slice.percent}%
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <ChartTable
            summary={labels.seeTable}
            columns={[labels.column, labels.total, '%']}
            rows={slices.map((slice) => ({
              key: slice.key,
              cells: [slice.label, slice.amount, `${slice.percent}%`],
            }))}
          />
        </div>
      )}
    </ChartCard>
  );
}
