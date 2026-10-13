'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { cn } from '@finnit/ui/lib/utils';

import { chartGeometry, indexAt, labeledIndexes } from '@/lib/simulator/chart';

const BASELINE_COLOR = 'var(--on-surface-variant)';
const SCENARIO_COLOR = 'var(--tertiary)';

/**
 * Balance month by month, "Hoy" (dashed) against the scenario (solid), on
 * one scale. Hover, touch or the arrow keys show a month's values.
 */
export function BalanceChart({
  labels,
  baseline,
  scenario,
  formatValue,
  formatAxis,
  monthTitle,
}: {
  /** Axis label per point ("Hoy", "Nov", …). */
  labels: string[];
  baseline: number[];
  scenario: number[];
  formatValue: (value: number) => string;
  /** Short amounts for the axis ("$12k"). */
  formatAxis: (value: number) => string;
  /** Tooltip title for point i ("Noviembre 2026"). */
  monthTitle: (index: number) => string;
}) {
  const t = useTranslations('simulator.chart');
  const plotRef = React.useRef<HTMLDivElement>(null);
  const [active, setActive] = React.useState<number | null>(null);
  const geometry = React.useMemo(
    () => chartGeometry([baseline, scenario]),
    [baseline, scenario],
  );
  const count = labels.length;
  const shown = labeledIndexes(count, 7);
  // Phones fit fewer labels.
  const shownNarrow = new Set(labeledIndexes(count, 4));
  const index = active !== null && active < count ? active : null;

  function pointAt(clientX: number) {
    const box = plotRef.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    setActive(indexAt((clientX - box.left) / box.width, count));
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const delta = event.key === 'ArrowRight' ? 1 : -1;
      setActive((current) =>
        Math.min(
          count - 1,
          Math.max(0, (current ?? (delta > 0 ? -1 : count)) + delta),
        ),
      );
    } else if (event.key === 'Escape') {
      setActive(null);
    }
  }

  const x = index !== null ? geometry.xs[index]! : 0;

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-on-surface-variant">
        <span className="flex items-center gap-1.5">
          <svg aria-hidden width="22" height="4">
            <line
              x1="0"
              y1="2"
              x2="22"
              y2="2"
              stroke={BASELINE_COLOR}
              strokeWidth="2"
              strokeDasharray="4 3"
            />
          </svg>
          {t('baseline')}
        </span>
        <span className="flex items-center gap-1.5">
          <svg aria-hidden width="22" height="4">
            <line
              x1="0"
              y1="2"
              x2="22"
              y2="2"
              stroke={SCENARIO_COLOR}
              strokeWidth="2.5"
            />
          </svg>
          {t('scenario')}
        </span>
      </figcaption>

      <div className="flex gap-2">
        {/* Y axis: top, middle and bottom values. */}
        <div aria-hidden className="relative h-56 w-12 shrink-0 sm:h-64">
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
            aria-label={t('label')}
            aria-roledescription={t('roleDescription')}
            onPointerMove={(e) => pointAt(e.clientX)}
            onPointerDown={(e) => pointAt(e.clientX)}
            onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
            onKeyDown={onKeyDown}
            onBlur={() => setActive(null)}
            className="relative h-56 touch-pan-y rounded-input outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:h-64"
          >
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden
              className="absolute inset-0 size-full overflow-visible"
            >
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
                <>
                  <rect
                    x="0"
                    y={geometry.zeroY}
                    width="100"
                    height={100 - geometry.zeroY}
                    fill="var(--expense)"
                    fillOpacity="0.06"
                  />
                  <line
                    x1="0"
                    x2="100"
                    y1={geometry.zeroY}
                    y2={geometry.zeroY}
                    stroke="var(--expense)"
                    strokeOpacity="0.6"
                    strokeWidth="1"
                    strokeDasharray="2 3"
                    vectorEffect="non-scaling-stroke"
                  />
                </>
              ) : null}
              <path
                d={geometry.paths[0]}
                fill="none"
                stroke={BASELINE_COLOR}
                strokeWidth="2"
                strokeDasharray="5 4"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={geometry.paths[1]}
                fill="none"
                stroke={SCENARIO_COLOR}
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
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

            {geometry.zeroY !== null ? (
              <span
                aria-hidden
                className="absolute left-1 -translate-y-full text-[10px] font-medium text-expense"
                style={{ top: `${geometry.zeroY}%` }}
              >
                {formatAxis(0)}
              </span>
            ) : null}

            {index !== null ? (
              <>
                {[0, 1].map((s) => (
                  <span
                    key={s}
                    aria-hidden
                    className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface"
                    style={{
                      left: `${x}%`,
                      top: `${geometry.ys[s]![index]}%`,
                      backgroundColor:
                        s === 0 ? BASELINE_COLOR : SCENARIO_COLOR,
                    }}
                  />
                ))}
                <div
                  role="status"
                  className="pointer-events-none absolute top-1 z-10 flex w-max max-w-[12rem] flex-col gap-0.5 rounded-input border border-outline bg-surface px-3 py-2 text-xs shadow-md"
                  style={
                    x > 50
                      ? { right: `${100 - x}%`, marginRight: 8 }
                      : { left: `${x}%`, marginLeft: 8 }
                  }
                >
                  <span className="font-bold text-on-background">
                    {monthTitle(index)}
                  </span>
                  <span className="text-on-surface-variant">
                    {t('baseline')}:{' '}
                    <span className="font-medium text-on-background tabular-nums">
                      {formatValue(baseline[index]!)}
                    </span>
                  </span>
                  <span className="text-on-surface-variant">
                    {t('scenario')}:{' '}
                    <span className="font-medium text-on-background tabular-nums">
                      {formatValue(scenario[index]!)}
                    </span>
                  </span>
                </div>
              </>
            ) : null}
          </div>

          {/* X axis */}
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
                {labels[i]}
              </span>
            ))}
          </div>
        </div>
      </div>
    </figure>
  );
}
