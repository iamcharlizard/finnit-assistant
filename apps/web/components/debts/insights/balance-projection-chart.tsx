'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import type { ProjectionPoint } from '@/lib/debts/insights-view';
import { ChartTable } from './chart-table';
import { ChartTooltip } from './chart-tooltip';

const WIDTH = 600;
const HEIGHT = 160;
const PAD = 8;

/**
 * What will still be owed at the end of each coming month, from the loans'
 * schedules and the other debts' minimums. A crosshair follows the pointer.
 */
export function BalanceProjectionChart({
  points,
  paidOffLabel,
}: {
  points: ProjectionPoint[];
  paidOffLabel: string | null;
}) {
  const t = useTranslations('debts.insights');
  const [active, setActive] = React.useState<number | null>(null);
  if (points.length === 0) return null;

  const max = Math.max(1, ...points.map((p) => p.value));
  const step = points.length > 1 ? WIDTH / (points.length - 1) : 0;
  const x = (i: number) => i * step;
  const y = (v: number) => PAD + (1 - v / max) * (HEIGHT - 2 * PAD);
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.value)}`)
    .join(' ');
  const hovered = active !== null ? points[active]! : null;
  const percentX = (i: number) =>
    points.length > 1 ? (i / (points.length - 1)) * 100 : 0;

  function onMove(event: React.PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - box.left) / box.width;
    setActive(
      Math.min(
        points.length - 1,
        Math.max(0, Math.round(ratio * (points.length - 1))),
      ),
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-card border border-outline bg-surface p-4">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-sm font-bold text-on-background">
          {t('projectionTitle')}
        </h3>
        <p className="text-xs text-on-surface-variant">
          {paidOffLabel
            ? t('projectionPaidOff', { month: paidOffLabel })
            : t('projectionNotPaidOff', { count: points.length })}
        </p>
      </div>

      <div
        className="relative h-40 touch-none"
        role="img"
        aria-label={t('projectionLabel', {
          from: points[0]!.amount,
          to: points[points.length - 1]!.amount,
          month: points[points.length - 1]!.label,
        })}
        onPointerMove={onMove}
        onPointerLeave={() => setActive(null)}
      >
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          aria-hidden
          className="size-full overflow-visible"
        >
          <line
            x1={0}
            x2={WIDTH}
            y1={HEIGHT - PAD}
            y2={HEIGHT - PAD}
            stroke="var(--outline)"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={`${path} L${WIDTH},${HEIGHT - PAD} L0,${HEIGHT - PAD} Z`}
            fill="var(--chart-1)"
            fillOpacity={0.12}
          />
          <path
            d={path}
            fill="none"
            stroke="var(--chart-1)"
            strokeWidth={2}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          {active !== null ? (
            <line
              x1={x(active)}
              x2={x(active)}
              y1={PAD}
              y2={HEIGHT - PAD}
              stroke="var(--on-surface-variant)"
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
        </svg>
        {hovered && active !== null ? (
          <>
            <span
              aria-hidden
              className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface"
              style={{
                left: `${percentX(active)}%`,
                top: `${(y(hovered.value) / HEIGHT) * 100}%`,
                background: 'var(--chart-1)',
              }}
            />
            <ChartTooltip
              title={hovered.label}
              className="top-0 bottom-auto mb-0 -translate-x-1/2 -translate-y-full"
              style={{
                left: `${Math.min(85, Math.max(15, percentX(active)))}%`,
              }}
              rows={[
                { key: 'owed', label: t('owedThen'), value: hovered.amount },
              ]}
            />
          </>
        ) : null}
      </div>
      <div
        aria-hidden
        className="flex justify-between text-[10px] text-on-surface-variant"
      >
        <span>{points[0]!.label}</span>
        <span>{points[Math.floor((points.length - 1) / 2)]!.label}</span>
        <span>{points[points.length - 1]!.label}</span>
      </div>

      <ChartTable
        summary={t('seeTable')}
        columns={[t('month'), t('owedThen')]}
        rows={points.map((p) => ({ key: p.key, cells: [p.label, p.amount] }))}
      />
    </section>
  );
}
