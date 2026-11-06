import * as React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslations } from 'use-intl';
import { ChartLine, PieChart } from 'lucide-react-native';

import { PROJECTION_MONTHS, analyticsData, analyticsQuery, type AnalyticsResult } from '@finnit/core/analytics/request';
import { buildAnalyticsView } from '@finnit/core/analytics/view';
import { monthOf, parseMonthParam, todayKey } from '@finnit/core/finance/dates';
import { CATEGORY_ICONS } from '@finnit/ui-native/lib/category-icons';
import { TwView } from '@finnit/ui-native/lib/tw';
import { AnalyticsHeroCard } from '@finnit/ui-native/components/finance/analytics-hero-card';
import { CategoryProgressItem } from '@finnit/ui-native/components/finance/category-progress-item';
import { FinancialHealthChart } from '@finnit/ui-native/components/finance/financial-health-chart';
import { EmptyState } from '@finnit/ui-native/components/ui/empty-state';
import { SectionHeading } from '@finnit/ui-native/components/ui/section-heading';
import { Text } from '@finnit/ui-native/components/ui/text';

import { CashFlowProjection } from '@/components/analytics/cash-flow-projection';
import { IncomeExpenseTrend } from '@/components/analytics/income-expense-trend';
import { MonthSwitcher } from '@/components/finance/month-switcher';
import { Screen } from '@/components/shell/screen';
import { useView } from '@/lib/graphql/use-view';
import { hrefParam } from '@/lib/nav/href';

/** Análisis: the month's spending, savings rate, trend, categories and projection. */
export function AnalyticsScreen() {
  const t = useTranslations();
  const router = useRouter();
  const params = useLocalSearchParams<{ month?: string }>();
  const current = monthOf(todayKey());
  const selected = parseMonthParam(params.month, current);
  const query = React.useMemo(() => analyticsQuery(selected), [selected.year, selected.month]); // eslint-disable-line react-hooks/exhaustive-deps

  const { view, loading, error, refreshing, refresh } = useView({
    query,
    variables: { monthsAhead: PROJECTION_MONTHS },
    build: (data: AnalyticsResult, l) => buildAnalyticsView(analyticsData(data, selected), { selected, current }, l),
  });
  const goTo = (href: string | null) => href && router.setParams({ month: hrefParam(href, 'month') });

  return (
    <Screen title={t('pageTitles.analytics')} loading={loading} error={error} refreshing={refreshing} onRefresh={refresh}>
      {view ? (
        view.isEmpty ? (
          <EmptyState
            icon={ChartLine}
            title={t('analytics.emptyTitle')}
            description={t('analytics.emptyDescription')}
            action={{ label: t('common.connectBank'), onPress: () => router.push('/connect-bank') }}
          />
        ) : (
          <TwView className="gap-6">
            <TwView className="items-center">
              <MonthSwitcher
                label={view.month.label}
                onPrevious={() => goTo(view.month.prevHref)}
                onNext={view.month.nextHref ? () => goTo(view.month.nextHref) : null}
              />
            </TwView>
            <TwView className="gap-4">
              <AnalyticsHeroCard
                label={t('analytics.monthSpending')}
                amount={view.spending.amount}
                trendPercent={view.spending.trendPercent ?? undefined}
                trendDown={view.spending.trendDown}
                sparkBars={view.spending.bars}
                trendDownLabel={t('ui.trend.down')}
                trendUpLabel={t('ui.trend.up')}
              />
              {view.savings ? (
                <FinancialHealthChart
                  label={t('analytics.savingsRate')}
                  percentage={view.savings.percentage}
                  rating={view.savings.rating}
                  caption={view.savings.caption}
                />
              ) : (
                <TwView className="items-center rounded-2xl border border-glass-border bg-glass p-5">
                  <Text weight="medium" className="mb-2 text-[15px] text-on-surface-variant">
                    {t('analytics.savingsRate')}
                  </Text>
                  <Text className="text-center text-sm text-on-surface-variant">{t('analytics.noIncome')}</Text>
                </TwView>
              )}
              <IncomeExpenseTrend months={view.trend} />
            </TwView>
            <TwView>
              <SectionHeading title={t('analytics.byCategory')} />
              {view.categories.length === 0 ? (
                <EmptyState icon={PieChart} title={t('analytics.noSpendingTitle')} description={t('analytics.noSpendingDescription')} />
              ) : (
                <TwView className="gap-2">
                  {view.categories.map((c) => (
                    <CategoryProgressItem
                      key={c.id}
                      label={t('analytics.categoryShare', { label: c.label, percent: String(c.percent) })}
                      amount={c.amount}
                      progressPercent={c.percent}
                      icon={CATEGORY_ICONS[c.iconKey]}
                      accentColor={c.color}
                    />
                  ))}
                </TwView>
              )}
            </TwView>
            <TwView>
              <SectionHeading title={t('analytics.cashFlow')} />
              <CashFlowProjection points={view.projection} />
            </TwView>
          </TwView>
        )
      ) : null}
    </Screen>
  );
}
