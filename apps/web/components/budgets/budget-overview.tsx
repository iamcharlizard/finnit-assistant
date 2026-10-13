'use client';

import { useTranslations } from 'next-intl';

import type { BudgetTotals } from '@/lib/budgets/view';
import { StatusText } from './status-text';
import { UsageBar } from './usage-bar';

/** The month's whole budget against everything spent. */
export function BudgetOverview({ totals }: { totals: BudgetTotals }) {
  const t = useTranslations('budgets.overview');
  return (
    <section className="flex flex-col gap-3 rounded-card border border-outline bg-surface p-5">
      <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-on-surface-variant">
        {t('title')}
      </h2>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-3xl font-bold text-on-background tabular-nums">
          {totals.spent}
        </span>
        <span className="text-sm text-on-surface-variant">
          {t('of', { amount: totals.budgeted })}
        </span>
      </p>
      <UsageBar
        percent={totals.percent}
        status={totals.status}
        label={t('barLabel', { percent: totals.percent })}
      />
      <div className="flex flex-wrap justify-between gap-2">
        <StatusText status={totals.status}>
          {totals.over
            ? t('over', { amount: totals.remaining })
            : t('left', { amount: totals.remaining })}
        </StatusText>
        <span className="text-xs text-on-surface-variant tabular-nums">
          {t('used', { percent: totals.percent })}
        </span>
      </div>
      <p className="text-xs text-on-surface-variant">
        {totals.explicitTotal
          ? t('explicitTotal', { amount: totals.capsSum })
          : t('capsTotal')}
      </p>
    </section>
  );
}
