'use client';

import { useTranslations } from 'next-intl';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';

import type { DebtInsightsView, LoadLevel } from '@finnit/core/debts/insights-view';

const LEVEL_ICON: Record<LoadLevel, typeof Info> = {
  low: CheckCircle2,
  moderate: Info,
  high: AlertTriangle,
};

/**
 * What is due in the next 30/60/90 days, and the share of the average
 * monthly income that goes to debt payments (icon + words, never color only).
 */
export function DebtLoadCard({ view }: { view: DebtInsightsView }) {
  const t = useTranslations('debts.insights');
  const load = view.load;
  const Icon = load ? LEVEL_ICON[load.level] : Info;
  return (
    <section className="flex flex-col gap-4 rounded-card border border-outline bg-surface p-4">
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-bold text-on-background">
          {t('upcomingTitle')}
        </h3>
        <dl className="grid grid-cols-3 gap-2">
          {(['days30', 'days60', 'days90'] as const).map((key) => (
            <div key={key} className="rounded-input bg-track/60 p-2">
              <dt className="text-[11px] text-on-surface-variant">
                {t(`upcoming.${key}`)}
              </dt>
              <dd className="text-base font-bold text-on-background tabular-nums">
                {view.upcoming[key]}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="flex flex-col gap-1 border-t border-outline pt-3">
        <h3 className="text-sm font-bold text-on-background">
          {t('loadTitle')}
        </h3>
        {load ? (
          <>
            <p className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-on-background tabular-nums">
                {load.percent}%
              </span>
              <span className="flex items-center gap-1 text-sm text-on-background">
                <Icon aria-hidden className="size-4" />
                {t(`loadLevels.${load.level}`)}
              </span>
            </p>
            <p className="text-xs text-on-surface-variant">
              {t('loadDetail', { monthly: view.monthly, income: load.income })}
            </p>
          </>
        ) : (
          <p className="text-xs text-on-surface-variant">
            {t('loadNoIncome', { monthly: view.monthly })}
          </p>
        )}
      </div>
    </section>
  );
}
