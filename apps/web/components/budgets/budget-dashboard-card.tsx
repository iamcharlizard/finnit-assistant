'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { PiggyBank } from 'lucide-react';

import type { BudgetCardView } from '@/lib/budgets/view';
import { StatusText } from './status-text';
import { UsageBar } from './usage-bar';

/** The dashboard's compact budget card: the month's spending against it. */
export function BudgetDashboardCard({ card }: { card: BudgetCardView }) {
  const t = useTranslations('budgets.card');
  return (
    <section className="flex flex-col gap-3 rounded-card border border-outline bg-surface p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold text-on-background">
          <PiggyBank aria-hidden className="size-5 text-on-surface-variant" />
          {t('title', { month: card.monthLabel })}
        </h2>
        <Link
          href="/planning/budgets"
          className="flex min-h-11 items-center text-sm font-medium text-income hover:underline"
        >
          {t('link')}
        </Link>
      </div>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-2xl font-bold text-on-background tabular-nums">
          {card.spent}
        </span>
        <span className="text-sm text-on-surface-variant">
          {t('of', { amount: card.budgeted })}
        </span>
      </p>
      <UsageBar
        percent={card.percent}
        status={card.status}
        label={t('barLabel', { percent: card.percent })}
      />
      <StatusText status={card.status}>
        {card.over
          ? t('over', { amount: card.remaining })
          : t('left', { amount: card.remaining, percent: card.percent })}
      </StatusText>
    </section>
  );
}
