'use client';

import { useTranslations } from 'next-intl';
import { ChartLine } from 'lucide-react';

import { AnalyticsHeroCard } from '@finnit/ui/components/finance/analytics-hero-card';
import { FinancialHealthChart } from '@finnit/ui/components/finance/financial-health-chart';
import { SectionHeading } from '@finnit/ui/components/ui/section-heading';

import { CashFlowProjection } from '@/components/analytics/cash-flow-projection';
import { CategoryBreakdown } from '@/components/analytics/category-breakdown';
import { IncomeExpenseTrend } from '@/components/analytics/income-expense-trend';
import { EmptyState } from '@/components/finance/empty-state';
import { MonthSwitcher } from '@/components/finance/month-switcher';
import type { AnalyticsView } from '@/lib/analytics/view';

export function AnalyticsScreen({ view }: { view: AnalyticsView }) {
  const t = useTranslations();
  if (view.isEmpty) {
    return (
      <EmptyState
        icon={ChartLine}
        title={t('analytics.emptyTitle')}
        description={t('analytics.emptyDescription')}
        action={{
          href: '/settings/banks/connect',
          label: t('common.connectBank'),
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <MonthSwitcher {...view.month} />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <AnalyticsHeroCard
          label={t('analytics.monthSpending')}
          amount={view.spending.amount}
          trendPercent={view.spending.trendPercent ?? undefined}
          trendDown={view.spending.trendDown}
          sparkBars={view.spending.bars}
          trendDownLabel={t('ui.trend.down')}
          trendUpLabel={t('ui.trend.up')}
          className="md:col-span-2 lg:col-span-1"
        />
        {view.savings ? (
          <FinancialHealthChart
            label={t('analytics.savingsRate')}
            percentage={view.savings.percentage}
            rating={view.savings.rating}
            caption={view.savings.caption}
          />
        ) : (
          <section className="flex flex-col justify-center rounded-2xl border border-glass-border bg-glass p-5 text-center backdrop-blur-md">
            <h3 className="mb-2 text-[15px] font-medium text-on-surface-variant">
              {t('analytics.savingsRate')}
            </h3>
            <p className="text-sm text-on-surface-variant">
              {t('analytics.noIncome')}
            </p>
          </section>
        )}
        <IncomeExpenseTrend months={view.trend} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="min-w-0">
          <SectionHeading title={t('analytics.byCategory')} />
          <CategoryBreakdown categories={view.categories} />
        </section>

        <section className="min-w-0">
          <SectionHeading title={t('analytics.cashFlow')} />
          <CashFlowProjection points={view.projection} />
        </section>
      </div>
    </div>
  );
}
