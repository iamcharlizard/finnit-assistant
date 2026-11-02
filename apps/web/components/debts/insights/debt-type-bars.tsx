'use client';

import { useTranslations } from 'next-intl';

import type { TypeBar } from '@/lib/debts/insights-view';

/**
 * What is owed now by kind of debt, as horizontal bars. Every bar carries
 * its name and amount (some colors are light on the light surface).
 */
export function DebtTypeBars({ bars }: { bars: TypeBar[] }) {
  const t = useTranslations('debts.insights');
  return (
    <section className="flex flex-col gap-3 rounded-card border border-outline bg-surface p-4">
      <h3 className="text-sm font-bold text-on-background">
        {t('byTypeTitle')}
      </h3>
      {bars.length === 0 ? (
        <p className="text-sm text-on-surface-variant">{t('nothingOwed')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {bars.map((bar) => (
            <li key={bar.type} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="flex items-center gap-2 text-on-background">
                  <span
                    aria-hidden
                    className="size-2.5 rounded-full"
                    style={{ background: bar.color }}
                  />
                  {bar.label}
                  <span className="text-on-surface-variant">
                    {t('count', { count: bar.count })}
                  </span>
                </span>
                <span className="font-medium text-on-background tabular-nums">
                  {bar.amount}
                </span>
              </div>
              <div className="h-2 rounded-full bg-track">
                <div
                  className="h-2 rounded-full"
                  style={{
                    width: `${Math.max(2, bar.percent)}%`,
                    background: bar.color,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
