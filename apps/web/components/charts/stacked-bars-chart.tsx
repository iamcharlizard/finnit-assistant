'use client';

import * as React from 'react';

import type { StackedBar } from '@finnit/core/finance/stacked-bars';
import { ChartCard } from '@/components/calendar/chart-card';
import { ChartTable } from '@/components/debts/insights/chart-table';
import { ChartTooltip } from '@/components/debts/insights/chart-tooltip';

export interface StackedSeries {
  key: string;
  label: string;
  /** A chart token, e.g. 'var(--chart-1)'. */
  color: string;
}

/**
 * Vertical bars stacked by series (a period or month each), with a legend,
 * a tooltip on hover or focus and the numbers as a table. Series keep their
 * order and colors; ones without any value are left out.
 */
export function StackedBarsChart({
  title,
  hint,
  bars,
  series: allSeries,
  labels,
}: {
  title: string;
  hint?: string;
  bars: StackedBar[];
  series: ReadonlyArray<StackedSeries>;
  labels: {
    /** Accessible name of one bar: (bar) => "16 nov: $1,200". */
    bar: (bar: StackedBar) => string;
    /** First column of the table ("Periodo", "Mes"). */
    column: string;
    total: string;
    seeTable: string;
    empty: string;
  };
}) {
  const [active, setActive] = React.useState<string | null>(null);
  const series = allSeries.filter((s) =>
    bars.some((b) => b.segments.some((x) => x.key === s.key && x.value > 0)),
  );
  const color = (key: string) =>
    allSeries.find((s) => s.key === key)?.color ?? 'var(--chart-1)';
  const label = (key: string) =>
    allSeries.find((s) => s.key === key)?.label ?? key;
  const shown = (bar: StackedBar) =>
    bar.segments.filter((s) => series.some((x) => x.key === s.key));
  const empty = bars.every((b) => b.value === 0);

  return (
    <ChartCard
      title={title}
      hint={hint}
      aside={
        <ul className="flex flex-wrap gap-3 text-[11px] text-on-surface-variant">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-1">
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ background: s.color }}
              />
              {s.label}
            </li>
          ))}
        </ul>
      }
    >
      {empty ? (
        <p className="text-sm text-on-surface-variant">{labels.empty}</p>
      ) : (
        <>
          <ul
            className="flex h-48 items-end gap-2 border-b border-outline"
            onPointerLeave={() => setActive(null)}
          >
            {bars.map((bar) => (
              <li
                key={bar.key}
                tabIndex={0}
                aria-label={labels.bar(bar)}
                onPointerEnter={() => setActive(bar.key)}
                onFocus={() => setActive(bar.key)}
                onBlur={() => setActive(null)}
                className="relative flex h-full flex-1 flex-col justify-end outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                {active === bar.key ? (
                  <ChartTooltip
                    title={bar.label}
                    className="left-1/2 -translate-x-1/2"
                    rows={[
                      ...shown(bar).map((segment) => ({
                        key: segment.key,
                        label: label(segment.key),
                        value: segment.amount,
                        color: color(segment.key),
                      })),
                      { key: 'total', label: labels.total, value: bar.total },
                    ]}
                  />
                ) : null}
                <span className="mb-1 text-center text-[10px] font-medium text-on-surface-variant tabular-nums">
                  {bar.value > 0 ? bar.total : ''}
                </span>
                <div
                  className="mx-auto flex w-full max-w-10 flex-col-reverse gap-[2px]"
                  style={{ height: `${bar.percent * 0.85}%` }}
                >
                  {shown(bar)
                    .filter((segment) => segment.value > 0)
                    .map((segment, i, visible) => (
                      <span
                        key={segment.key}
                        className={
                          i === visible.length - 1 ? 'rounded-t-[4px]' : ''
                        }
                        style={{
                          flexGrow: segment.value,
                          flexBasis: 0,
                          minHeight: 2,
                          background: color(segment.key),
                        }}
                      />
                    ))}
                </div>
              </li>
            ))}
          </ul>
          <ul aria-hidden className="-mt-1 flex gap-2">
            {bars.map((bar) => (
              <li
                key={bar.key}
                className="flex-1 truncate text-center text-[11px] text-on-surface-variant"
              >
                {bar.label}
              </li>
            ))}
          </ul>
          <ChartTable
            summary={labels.seeTable}
            columns={[
              labels.column,
              ...series.map((s) => s.label),
              labels.total,
            ]}
            rows={bars.map((bar) => ({
              key: bar.key,
              cells: [
                bar.label,
                ...shown(bar).map((segment) => segment.amount),
                bar.total,
              ],
            }))}
          />
        </>
      )}
    </ChartCard>
  );
}
