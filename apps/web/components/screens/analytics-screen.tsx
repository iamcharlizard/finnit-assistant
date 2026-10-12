'use client';

import * as React from 'react';
import { ShoppingBag, Utensils } from 'lucide-react';

import { AnalyticsHeroCard } from '@finnit/ui/components/finance/analytics-hero-card';
import { CategoryProgressItem } from '@finnit/ui/components/finance/category-progress-item';
import { FilterChipGroup } from '@finnit/ui/components/finance/filter-chip-group';
import { FinancialHealthChart } from '@finnit/ui/components/finance/financial-health-chart';
import { MonthlyDistributionChart } from '@finnit/ui/components/finance/monthly-distribution-chart';
import { NeoTipCard } from '@finnit/ui/components/finance/neo-tip-card';
import { SectionHeading } from '@finnit/ui/components/ui/section-heading';

import {
  MONTH_BARS,
  PERIOD_ITEMS,
  type PeriodValue,
} from '@/lib/mocks/analytics';

function isPeriodValue(v: string): v is PeriodValue {
  return PERIOD_ITEMS.some((p) => p.value === v);
}

export function AnalyticsScreen() {
  const [activePeriod, setActivePeriod] = React.useState<PeriodValue>('mes');

  return (
    <div className="flex flex-col gap-6">
      <FilterChipGroup
        items={PERIOD_ITEMS}
        activeValue={activePeriod}
        onSelect={(v) => {
          if (isPeriodValue(v)) setActivePeriod(v);
        }}
        aria-label="Periodo"
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <AnalyticsHeroCard
          label="Gasto Total"
          amount="$4,820.50"
          trendPercent="12%"
          trendDown
          className="md:col-span-2 lg:col-span-1"
        />
        <FinancialHealthChart percentage={75} />
        <MonthlyDistributionChart bars={MONTH_BARS} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <SectionHeading
            title="Categorías Principales"
            action={
              <a
                href="#"
                aria-label="Ver todas las categorías"
                className="flex min-h-11 items-center text-[13px] font-medium text-accent-neon hover:underline"
              >
                Ver todo
              </a>
            }
          />
          <div className="flex flex-col gap-2">
            <CategoryProgressItem
              label="Compras"
              amount="$1,250"
              progressPercent={65}
              icon={ShoppingBag}
              accentColor="var(--highlight)"
            />
            <CategoryProgressItem
              label="Restaurantes"
              amount="$840"
              progressPercent={45}
              icon={Utensils}
              accentColor="#6c72cb"
            />
          </div>
        </section>

        <section>
          <SectionHeading title="Finnit Tips" />
          <NeoTipCard
            title="Optimización de Suscripciones"
            body="Detectamos 3 suscripciones que no has usado en los últimos 30 días. Podrías ahorrar "
            highlight="$45.00/mes"
            bodyAfterHighlight=" cancelándolas."
            actionLabel="Optimizar ahora"
          />
        </section>
      </div>
    </div>
  );
}
