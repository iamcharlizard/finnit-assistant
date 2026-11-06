'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import {
  MONTH_SERIES,
  SERIES_COLOR,
  type MonthBar,
  type MonthSeries,
} from '@finnit/core/calendar/summary';
import { ChartTable } from '@/components/debts/insights/chart-table';
import { ChartTooltip } from '@/components/debts/insights/chart-tooltip';
import { ChartCard } from './chart-card';

/**
 * What is due each of the next months, stacked by series (recurring,
 * loans, card payments). Hover or focus a month for its numbers.
 */
export function MonthsChart({
  months,
  hasCardEstimate,
}: {
  months: MonthBar[];
  hasCardEstimate: boolean;
}) {
  const t = useTranslations('calendar.summary');
  const [active, setActive] = React.useState<string | null>(null);
  const label = (s: MonthSeries) => t(`series.${s}`);
  // Only the series that have something (cards only with a debt).
  const series = MONTH_SERIES.filter((s) =>
    months.some((m) => m.segments.some((x) => x.series === s && x.value > 0)),
  );
  const empty = months.every((m) => m.value === 0);

  return (
    <ChartCard
      title={t('monthsTitle', { count: months.length })}
      hint={hasCardEstimate ? t('monthsHint') : undefined}
      aside={
        <ul className="flex flex-wrap gap-3 text-[11px] text-on-surface-variant">
          {series.map((s) => (
            <li key={s} className="flex items-center gap-1">
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ background: SERIES_COLOR[s] }}
              />
              {label(s)}
            </li>
          ))}
        </ul>
      }
    >
      {empty ? (
        <p className="text-sm text-on-surface-variant">{t('empty')}</p>
      ) : (
        <>
          <ul
            className="flex h-48 items-end gap-2 border-b border-outline"
            onPointerLeave={() => setActive(null)}
          >
            {months.map((month) => (
              <li
                key={month.key}
                tabIndex={0}
                aria-label={t('monthLabel', {
                  month: month.label,
                  amount: month.total,
                })}
                onPointerEnter={() => setActive(month.key)}
                onFocus={() => setActive(month.key)}
                onBlur={() => setActive(null)}
                className="relative flex h-full flex-1 flex-col justify-end outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                {active === month.key ? (
                  <ChartTooltip
                    title={month.label}
                    className="left-1/2 -translate-x-1/2"
                    rows={[
                      ...month.segments
                        .filter((s) => series.includes(s.series))
                        .map((segment) => ({
                          key: segment.series,
                          label: label(segment.series),
                          value: segment.amount,
                          color: SERIES_COLOR[segment.series],
                        })),
                      { key: 'total', label: t('total'), value: month.total },
                    ]}
                  />
                ) : null}
                <span className="mb-1 text-center text-[10px] font-medium text-on-surface-variant tabular-nums">
                  {month.value > 0 ? month.total : ''}
                </span>
                <div
                  className="mx-auto flex w-full max-w-10 flex-col-reverse gap-[2px]"
                  style={{ height: `${month.percent * 0.85}%` }}
                >
                  {month.segments
                    .filter((segment) => segment.value > 0)
                    .map((segment, i, shown) => (
                      <span
                        key={segment.series}
                        className={
                          i === shown.length - 1 ? 'rounded-t-[4px]' : ''
                        }
                        style={{
                          flexGrow: segment.value,
                          flexBasis: 0,
                          minHeight: 2,
                          background: SERIES_COLOR[segment.series],
                        }}
                      />
                    ))}
                </div>
              </li>
            ))}
          </ul>
          <ul aria-hidden className="-mt-1 flex gap-2">
            {months.map((month) => (
              <li
                key={month.key}
                className="flex-1 text-center text-[11px] text-on-surface-variant capitalize"
              >
                {month.label}
              </li>
            ))}
          </ul>
          <ChartTable
            summary={t('seeTable')}
            columns={[t('month'), ...series.map(label), t('total')]}
            rows={months.map((month) => ({
              key: month.key,
              cells: [
                month.label,
                ...month.segments
                  .filter((s) => series.includes(s.series))
                  .map((segment) => segment.amount),
                month.total,
              ],
            }))}
          />
        </>
      )}
    </ChartCard>
  );
}
