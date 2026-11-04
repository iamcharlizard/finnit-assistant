'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { Progress } from '@finnit/ui/components/ui/progress';
import { SectionHeading } from '@finnit/ui/components/ui/section-heading';

import { BalanceProjectionChart } from '@/components/debts/insights/balance-projection-chart';
import { DebtTypeBars } from '@/components/debts/insights/debt-type-bars';
import { buildDebtInsightsView } from '@/lib/debts/insights-view';
import type { ApiDebtInsights } from '@/lib/debts/types';
import { DEBTS_PATH } from '@/lib/debts/view';
import type { DayKey } from '@/lib/finance/dates';
import { useLocalizer } from '@/lib/i18n/client';

const LINK_CLASS =
  'flex min-h-11 items-center text-sm font-medium text-income hover:underline';

/**
 * Debts at a glance on the home screen: what is owed, how much of it is
 * paid, the monthly payments with their share of income, and two charts
 * (owed by type, projected balance). Card MSI plans are left out, as in
 * the debts screen by default.
 */
export function DashboardDebts({
  insights,
  today,
}: {
  insights: ApiDebtInsights;
  today: DayKey;
}) {
  const l = useLocalizer();
  const t = useTranslations('dashboard.debts');
  const ti = useTranslations('debts.insights');
  const view = React.useMemo(
    () => buildDebtInsightsView(insights, { today, includeMsi: false }, l),
    [insights, today, l],
  );

  return (
    <section aria-label={t('title')} className="min-w-0">
      <SectionHeading
        title={t('title')}
        action={
          <Link href={DEBTS_PATH} className={LINK_CLASS}>
            {t('seeAll')}
          </Link>
        }
      />
      {/*
        One column on phones. From @2xl: summary and "por tipo" stacked on
        the left, the projection on the right filling their height (no
        half-empty card); its three figures stack until the column has room
        for them side by side (@5xl). From @7xl (dashboard in four columns):
        all three cards in a row, figures stacked.
      */}
      <div className="grid gap-3 @2xl:grid-cols-2 @7xl:grid-cols-3">
        <div className="flex flex-col gap-3 rounded-card border border-outline bg-surface p-4 @2xl:col-start-1 @7xl:col-start-auto">
          <dl className="grid gap-4 sm:grid-cols-3 @2xl:grid-cols-1 @5xl:grid-cols-3 @7xl:grid-cols-1">
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-on-surface-variant">
                {ti('current')}
              </dt>
              <dd className="text-2xl font-bold text-on-background tabular-nums">
                {view.current}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-on-surface-variant">
                {ti('paidSoFar')}
              </dt>
              <dd className="text-2xl font-bold text-on-background tabular-nums">
                {view.paid}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-on-surface-variant">
                {t('monthly')}
              </dt>
              <dd className="text-2xl font-bold text-on-background tabular-nums">
                {view.monthly}
              </dd>
              <dd className="text-xs text-on-surface-variant">
                {view.load
                  ? t('load', {
                      percent: view.load.percent,
                      level: ti(`loadLevels.${view.load.level}`),
                    })
                  : t('noIncome')}
              </dd>
            </div>
          </dl>
          <Progress
            value={view.paidPercent}
            indicatorColor="var(--chart-1)"
            aria-label={ti('currentVsTotal', { percent: view.paidPercent })}
            className="h-2"
          />
          <p className="text-xs text-on-surface-variant">
            {ti('currentVsTotal', { percent: view.paidPercent })}
          </p>
        </div>
        <DebtTypeBars
          bars={view.types}
          className="@2xl:col-start-1 @7xl:col-start-auto"
        />
        <BalanceProjectionChart
          points={view.projection}
          paidOffLabel={view.paidOffLabel}
          className="@2xl:col-start-2 @2xl:row-span-2 @2xl:row-start-1 @7xl:col-start-auto @7xl:row-span-1"
        />
      </div>
    </section>
  );
}
