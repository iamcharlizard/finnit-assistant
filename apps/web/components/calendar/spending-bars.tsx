'use client';

import { useTranslations } from 'next-intl';

import type { Bar } from '@finnit/core/calendar/summary';
import { ChartCard } from './chart-card';

/**
 * Monthly fixed spending split by something (type or account), as
 * horizontal bars of one color. Every bar carries its name and amount.
 */
export function SpendingBars({ title, bars }: { title: string; bars: Bar[] }) {
  const t = useTranslations('calendar.summary');
  return (
    <ChartCard title={title} hint={t('perMonthHint')}>
      {bars.length === 0 ? (
        <p className="text-sm text-on-surface-variant">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {bars.map((bar) => (
            <li key={bar.key} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="flex min-w-0 items-baseline gap-2 text-on-background">
                  <span className="truncate">{bar.label}</span>
                  <span className="shrink-0 text-on-surface-variant">
                    {t('count', { count: bar.count })}
                  </span>
                </span>
                <span className="shrink-0 font-medium text-on-background tabular-nums">
                  {bar.amount}
                </span>
              </div>
              <div className="h-2 rounded-full bg-track">
                <div
                  className="h-2 rounded-full"
                  style={{
                    width: `${Math.max(2, bar.percent)}%`,
                    background: 'var(--chart-1)',
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </ChartCard>
  );
}
