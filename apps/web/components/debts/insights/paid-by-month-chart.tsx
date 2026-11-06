'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import {
  PAID_COLOR,
  type PaidMonthBar,
  type PaidSeries,
} from '@finnit/core/debts/insights-view';
import { ChartTable } from './chart-table';
import { ChartTooltip } from './chart-tooltip';

/**
 * What was paid each month, stacked: payments in your totals, payments
 * made before registering the debt and (optionally) card MSI installments.
 * Hover or focus a month for its numbers.
 */
export function PaidByMonthChart({
  months,
  series,
  hasPayments,
}: {
  months: PaidMonthBar[];
  series: PaidSeries[];
  hasPayments: boolean;
}) {
  const t = useTranslations('debts.insights');
  const [active, setActive] = React.useState<string | null>(null);
  const label = (s: PaidSeries) => t(`paidSeries.${s}`);

  return (
    <section className="flex flex-col gap-3 rounded-card border border-outline bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-on-background">
          {t('paidTitle')}
        </h3>
        <ul className="flex flex-wrap gap-3 text-[11px] text-on-surface-variant">
          {series.map((s) => (
            <li key={s} className="flex items-center gap-1">
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ background: PAID_COLOR[s] }}
              />
              {label(s)}
            </li>
          ))}
        </ul>
      </div>

      {hasPayments ? (
        <>
          <ul
            className="flex h-44 items-end gap-1 border-b border-outline"
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
                className="relative flex h-full flex-1 flex-col justify-end rounded-t-[4px] outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                {active === month.key ? (
                  <ChartTooltip
                    title={month.label}
                    className="left-1/2 -translate-x-1/2"
                    rows={[
                      ...month.segments.map((segment) => ({
                        key: segment.series,
                        label: label(segment.series),
                        value: segment.amount,
                        color: PAID_COLOR[segment.series],
                      })),
                      {
                        key: 'total',
                        label: t('monthTotal'),
                        value: month.total,
                      },
                    ]}
                  />
                ) : null}
                <div
                  className="mx-auto flex w-full max-w-6 flex-col-reverse gap-[2px]"
                  style={{ height: `${month.percent}%` }}
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
                          background: PAID_COLOR[segment.series],
                        }}
                      />
                    ))}
                </div>
              </li>
            ))}
          </ul>
          <ul aria-hidden className="-mt-2 flex gap-1">
            {months.map((month, i) => (
              <li
                key={month.key}
                className="flex-1 text-center text-[10px] text-on-surface-variant"
              >
                {/* Every other label on narrow screens. */}
                <span className={i % 2 === 1 ? 'hidden sm:inline' : ''}>
                  {month.label}
                </span>
              </li>
            ))}
          </ul>
          <ChartTable
            summary={t('seeTable')}
            columns={[t('month'), ...series.map(label), t('monthTotal')]}
            rows={months.map((month) => ({
              key: month.key,
              cells: [
                month.label,
                ...month.segments.map((segment) => segment.amount),
                month.total,
              ],
            }))}
          />
        </>
      ) : (
        <p className="text-sm text-on-surface-variant">{t('noPayments')}</p>
      )}
    </section>
  );
}
