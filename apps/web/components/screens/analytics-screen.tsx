'use client';

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
  if (view.isEmpty) {
    return (
      <EmptyState
        icon={ChartLine}
        title="Aún no hay datos para analizar"
        description="Conecta tu banco: con tus movimientos verás tus gastos por categoría, la tendencia de tus ingresos y gastos y una proyección de tu saldo."
        action={{ href: '/settings/banks/connect', label: 'Conectar banco' }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <MonthSwitcher {...view.month} />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <AnalyticsHeroCard
          label="Gasto del mes"
          amount={view.spending.amount}
          trendPercent={view.spending.trendPercent ?? undefined}
          trendDown={view.spending.trendDown}
          sparkBars={view.spending.bars}
          className="md:col-span-2 lg:col-span-1"
        />
        {view.savings ? (
          <FinancialHealthChart
            label="Tasa de ahorro"
            percentage={view.savings.percentage}
            rating={view.savings.rating}
            caption={view.savings.caption}
          />
        ) : (
          <section className="flex flex-col justify-center rounded-2xl border border-glass-border bg-glass p-5 text-center backdrop-blur-md">
            <h3 className="mb-2 text-[15px] font-medium text-on-surface-variant">
              Tasa de ahorro
            </h3>
            <p className="text-sm text-on-surface-variant">
              Sin ingresos registrados este mes.
            </p>
          </section>
        )}
        <IncomeExpenseTrend months={view.trend} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="min-w-0">
          <SectionHeading title="Gastos por categoría" />
          <CategoryBreakdown categories={view.categories} />
        </section>

        <section className="min-w-0">
          <SectionHeading title="Flujo de caja" />
          <CashFlowProjection points={view.projection} />
        </section>
      </div>
    </div>
  );
}
