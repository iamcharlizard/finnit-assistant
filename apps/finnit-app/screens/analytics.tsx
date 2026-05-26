import { useState } from 'react';
import { TwView, TwText, TwScrollView, TwPressable } from '@/lib/tw';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { TopAppBar } from '@/components/navigation/top-app-bar';
import { FilterChipGroup } from '@/components/features/finance/filter-chips';
import { AnalyticsHeroCard } from '@/components/features/finance/analytics-hero-card';
import { FinancialHealthChart } from '@/components/features/finance/financial-health-chart';
import { MonthlyDistributionChart } from '@/components/features/finance/monthly-distribution-chart';
import { CategoryProgressItem } from '@/components/features/finance/category-progress-item';
import { NeoTipCard } from '@/components/features/finance/neo-tip-card';
import { useTheme } from '@/contexts/ThemeContext';

// TODO: replace with real API call
// const { data } = useQuery({ queryKey: ['analytics', 'summary'], queryFn: fetchAnalyticsSummary })

type PeriodValue = 'semana' | 'mes' | 'año';

const PERIOD_ITEMS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mes' },
  { value: 'año', label: 'Año' },
];

const MONTH_BARS = [
  { label: 'Ene', heightPercent: 48 },
  { label: 'Feb', heightPercent: 72, highlighted: true },
  { label: 'Mar', heightPercent: 62 },
  { label: 'Abr', heightPercent: 92, highlighted: true },
] as const;

function isPeriodValue(v: string): v is PeriodValue {
  return v === 'semana' || v === 'mes' || v === 'año';
}

export function AnalyticsScreen() {
  const { isDark } = useTheme();
  const [activePeriod, setActivePeriod] = useState<PeriodValue>('mes');

  const bg = isDark ? '#12131a' : '#f8f9fa';
  const textPrimary = isDark ? '#e3e1eb' : '#1a1b22';
  const accentLink = isDark ? '#bfc2ff' : '#6c72cb';

  function handlePeriodSelect(v: string) {
    if (isPeriodValue(v)) setActivePeriod(v);
  }

  return (
    <TwView className="flex-1" style={{ backgroundColor: bg }}>
      <TopAppBar title="Finnit Analytics" notificationCount={0} onNotificationsPress={() => {}} />

      <TwScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="pb-8"
        showsVerticalScrollIndicator={false}
      >
        {/* Time Range Selector */}
        <Animated.View entering={FadeIn.duration(300)}>
          <TwView className="px-5 pt-5 mb-6">
            <FilterChipGroup items={PERIOD_ITEMS} activeValue={activePeriod} onSelect={handlePeriodSelect} />
          </TwView>
        </Animated.View>

        {/* Hero Card */}
        <TwView className="px-5">
          <AnalyticsHeroCard label="Gasto Total" amount="$4,820.50" trendPercent="12%" trendDown />
        </TwView>

        {/* Financial Health Donut Chart */}
        <TwView className="px-5">
          <FinancialHealthChart
            percentage={75}
            label="Salud Financiera"
            rating="Excelente"
            caption="Tu ratio de ahorro ha subido un 5% respecto al mes pasado."
          />
        </TwView>

        {/* Monthly Distribution Bar Chart */}
        <TwView className="px-5">
          <MonthlyDistributionChart title="Distribución Mensual" bars={[...MONTH_BARS]} />
        </TwView>

        {/* Categorías Principales */}
        <Animated.View entering={FadeInUp.duration(400).delay(350)}>
          <TwView className="px-5 mb-4">
            <TwView className="flex-row justify-between items-center mb-3">
              <TwText style={{ fontFamily: 'Ubuntu Bold', fontSize: 20, lineHeight: 28, color: textPrimary }}>
                Categorías Principales
              </TwText>
              <TwPressable
                onPress={() => {}}
                accessibilityRole="button"
                accessibilityLabel="Ver todas las categorías"
                style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 }}
              >
                <TwText style={{ fontFamily: 'Ubuntu Medium', fontSize: 13, color: accentLink }}>Ver todo</TwText>
              </TwPressable>
            </TwView>

            <CategoryProgressItem
              label="Compras"
              amount="$1,250"
              progressPercent={65}
              symbolName="bag.fill"
              iconBg="rgba(255,171,242,0.12)"
              iconTint="#ffabf2"
              barColor="#ffabf2"
              index={0}
              onPress={() => {}}
            />
            <CategoryProgressItem
              label="Restaurantes"
              amount="$840"
              progressPercent={45}
              symbolName="fork.knife"
              iconBg="rgba(191,194,255,0.12)"
              iconTint="#bfc2ff"
              barColor="#bfc2ff"
              index={1}
              onPress={() => {}}
            />
          </TwView>
        </Animated.View>

        {/* Finnit Tips */}
        <Animated.View entering={FadeInUp.duration(400).delay(520)}>
          <TwView className="px-5">
            <TwText style={{ fontFamily: 'Ubuntu Bold', fontSize: 20, lineHeight: 28, color: textPrimary, marginBottom: 12 }}>
              Finnit Tips
            </TwText>
            <NeoTipCard
              title="Optimización de Suscripciones"
              body="Detectamos 3 suscripciones que no has usado en los últimos 30 días. Podrías ahorrar "
              highlight="$45.00/mes"
              bodyAfterHighlight=" cancelándolas."
              actionLabel="Optimizar ahora"
              onActionPress={() => {}}
            />
          </TwView>
        </Animated.View>
      </TwScrollView>

    </TwView>
  );
}
