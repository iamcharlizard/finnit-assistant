'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { Card } from '@finnit/ui/components/ui/card';
import { cn } from '@finnit/ui/lib/utils';

import { ChartTable } from '@/components/debts/insights/chart-table';
import type { ChartDay } from '@finnit/core/accounts/balance-history';
import type { DayKey } from '@finnit/core/finance/dates';
import { formatMoney } from '@finnit/core/finance/money';
import {
  chartGeometry,
  compactAmount,
  indexAt,
  labeledIndexes,
} from '@finnit/core/simulator/chart';

export interface ChartSeries {
  key: string;
  label: string;
  /** A `--chart-N` slot, in the fixed order (never a status color). */
  color: string;
  /** One per day. */
  values: number[];
  /** Formatted values. */
  amounts: string[];
}

/**
 * Balances at the end of each day, one line per series on one scale (two
 * or more get a legend). Hover, touch or the arrow keys show a day;
 * clicking or Enter opens it. Days before the history can be trusted are
 * shaded; the chosen day is marked.
 */
export function DailyBalanceChart({
  title,
  days,
  series,
  selectedDay,
  completeFromLabel,
  currency,
  onDay,
}: {
  title: string;
  /** Oldest first. */
  days: ChartDay[];
  series: ChartSeries[];
  selectedDay: DayKey;
  completeFromLabel: string | null;
  currency: string;
  onDay: (day: DayKey) => void;
}) {
  const t = useTranslations('accounts.balanceDay');
  const locale = useLocale();
  const plotRef = React.useRef<HTMLDivElement>(null);
  const [active, setActive] = React.useState<number | null>(null);
  const geometry = React.useMemo(
    () => chartGeometry(series.map((s) => s.values)),
    [series],
  );
  const count = days.length;
  const shown = labeledIndexes(count, 7);
  const shownNarrow = new Set(labeledIndexes(count, 4));
  const selected = days.findIndex((d) => d.day === selectedDay);
  const index = active !== null && active < count ? active : null;
  const firstComplete = days.findIndex((d) => d.complete);
  const shadeTo =
    firstComplete === -1
      ? 100
      : firstComplete === 0
        ? 0
        : geometry.xs[firstComplete]!;
  const formatAxis = (value: number) =>
    compactAmount(value, (amount) =>
      formatMoney(amount, currency, locale, { wholeUnits: true }),
    );

  function pointAt(clientX: number) {
    const box = plotRef.current?.getBoundingClientRect();
    if (!box || box.width === 0) return null;
    const i = indexAt((clientX - box.left) / box.width, count);
    setActive(i);
    return i;
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const delta = event.key === 'ArrowRight' ? 1 : -1;
      setActive((current) =>
        Math.min(
          count - 1,
          Math.max(0, (current ?? (selected >= 0 ? selected : count)) + delta),
        ),
      );
    } else if (event.key === 'Enter' && index !== null) {
      onDay(days[index]!.day);
    } else if (event.key === 'Escape') {
      setActive(null);
    }
  }

  if (count < 2 || series.length === 0) return null;
  const x = index !== null ? geometry.xs[index]! : 0;
  const selectedX = selected >= 0 ? geometry.xs[selected]! : null;

  return (
    <Card className="gap-3 rounded-[20px] p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-bold text-on-background">{title}</h3>
          <p className="text-xs text-on-surface-variant">{t('chartHint')}</p>
        </div>
        {series.length > 1 ? (
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-on-surface-variant">
            {series.map((s) => (
              <li key={s.key} className="flex items-center gap-1.5">
                <svg aria-hidden width="18" height="4">
                  <line
                    x1="0"
                    y1="2"
                    x2="18"
                    y2="2"
                    stroke={s.color}
                    strokeWidth="2"
                  />
                </svg>
                {s.label}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="flex gap-2">
        <div aria-hidden className="relative h-44 w-12 shrink-0">
          {geometry.ticks.map((tick) => (
            <span
              key={tick.y}
              className="absolute right-0 -translate-y-1/2 text-[10px] text-on-surface-variant tabular-nums"
              style={{ top: `${tick.y}%` }}
            >
              {formatAxis(tick.value)}
            </span>
          ))}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div
            ref={plotRef}
            role="group"
            tabIndex={0}
            aria-label={t('chartLabel')}
            onPointerMove={(e) => pointAt(e.clientX)}
            onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
            onClick={(e) => {
              const i = pointAt(e.clientX);
              if (i !== null) onDay(days[i]!.day);
            }}
            onKeyDown={onKeyDown}
            onBlur={() => setActive(null)}
            className="relative h-44 cursor-pointer touch-pan-y rounded-input outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden
              className="absolute inset-0 size-full overflow-visible"
            >
              {shadeTo > 0 ? (
                <rect
                  x="0"
                  y="0"
                  width={shadeTo}
                  height="100"
                  fill="var(--on-surface-variant)"
                  fillOpacity="0.08"
                />
              ) : null}
              {geometry.ticks.map((tick) => (
                <line
                  key={tick.y}
                  x1="0"
                  x2="100"
                  y1={tick.y}
                  y2={tick.y}
                  stroke="var(--outline)"
                  strokeOpacity="0.5"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {geometry.zeroY !== null ? (
                <line
                  x1="0"
                  x2="100"
                  y1={geometry.zeroY}
                  y2={geometry.zeroY}
                  stroke="var(--on-surface-variant)"
                  strokeOpacity="0.6"
                  strokeWidth="1"
                  strokeDasharray="2 3"
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}
              {series.map((s, i) => (
                <path
                  key={s.key}
                  d={geometry.paths[i]}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {selectedX !== null ? (
                <line
                  x1={selectedX}
                  x2={selectedX}
                  y1="0"
                  y2="100"
                  stroke="var(--highlight)"
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}
              {index !== null ? (
                <line
                  x1={x}
                  x2={x}
                  y1="0"
                  y2="100"
                  stroke="var(--on-surface-variant)"
                  strokeOpacity="0.5"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}
            </svg>

            {selected >= 0
              ? series.map((s, i) => (
                  <span
                    key={s.key}
                    aria-hidden
                    className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-highlight"
                    style={{
                      left: `${selectedX}%`,
                      top: `${geometry.ys[i]![selected]}%`,
                    }}
                  />
                ))
              : null}

            {index !== null ? (
              <>
                {series.map((s, i) => (
                  <span
                    key={s.key}
                    aria-hidden
                    className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface"
                    style={{
                      left: `${x}%`,
                      top: `${geometry.ys[i]![index]}%`,
                      backgroundColor: s.color,
                    }}
                  />
                ))}
                <div
                  role="status"
                  className="pointer-events-none absolute top-1 z-10 flex w-max max-w-[15rem] flex-col gap-0.5 rounded-input border border-outline bg-popover px-3 py-2 text-xs shadow-md"
                  style={
                    x > 50
                      ? { right: `${100 - x}%`, marginRight: 8 }
                      : { left: `${x}%`, marginLeft: 8 }
                  }
                >
                  <span className="font-bold text-on-background">
                    {days[index]!.title}
                  </span>
                  {series.map((s) => (
                    <span key={s.key} className="text-on-surface-variant">
                      {series.length > 1 ? `${s.label}: ` : null}
                      <span className="font-medium text-on-background tabular-nums">
                        {s.amounts[index]}
                      </span>
                    </span>
                  ))}
                  {days[index]!.complete ? null : (
                    <span className="text-on-surface-variant">
                      {t('incompleteShort')}
                    </span>
                  )}
                </div>
              </>
            ) : null}
          </div>

          <div aria-hidden className="relative h-4">
            {shown.map((i) => (
              <span
                key={i}
                className={cn(
                  'absolute top-0 text-[10px] whitespace-nowrap text-on-surface-variant',
                  !shownNarrow.has(i) && 'hidden sm:block',
                )}
                style={{
                  left: `${geometry.xs[i]}%`,
                  transform:
                    i === 0
                      ? 'none'
                      : i === count - 1
                        ? 'translateX(-100%)'
                        : 'translateX(-50%)',
                }}
              >
                {days[i]!.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {completeFromLabel ? (
        <p className="text-xs text-on-surface-variant">
          {t('completeFrom', { date: completeFromLabel })}
        </p>
      ) : null}

      <ChartTable
        summary={t('table')}
        columns={[t('tableDay'), ...series.map((s) => s.label)]}
        rows={[...days].reverse().map((d, r) => {
          const i = days.length - 1 - r;
          return {
            key: d.day,
            cells: [
              d.complete ? d.title : `${d.title} · ${t('incompleteShort')}`,
              ...series.map((s) => s.amounts[i]!),
            ],
          };
        })}
      />
    </Card>
  );
}
