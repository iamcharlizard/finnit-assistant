import { useTranslations } from 'use-intl';

import type { AnalyticsView } from '@finnit/core/analytics/view';
import { TwView } from '@finnit/ui-native/lib/tw';
import { Text } from '@finnit/ui-native/components/ui/text';

/** Income vs expenses per month, as paired bars. */
export function IncomeExpenseTrend({ months }: { months: AnalyticsView['trend'] }) {
  const t = useTranslations('analytics.trend');
  return (
    <TwView className="rounded-2xl border border-glass-border bg-glass p-5">
      <TwView className="mb-4 flex-row flex-wrap items-center justify-between gap-2">
        <Text weight="medium" className="text-[15px] text-on-surface-variant">
          {t('title')}
        </Text>
        <TwView className="flex-row gap-3">
          <TwView className="flex-row items-center gap-1">
            <TwView className="size-2 rounded-full bg-income" />
            <Text className="text-[11px] text-on-surface-variant">{t('income')}</Text>
          </TwView>
          <TwView className="flex-row items-center gap-1">
            <TwView className="size-2 rounded-full bg-expense" />
            <Text className="text-[11px] text-on-surface-variant">{t('expenses')}</Text>
          </TwView>
        </TwView>
      </TwView>
      <TwView className="h-44 flex-row items-end justify-between gap-2">
        {months.map((m) => (
          <TwView
            key={m.label}
            accessible
            accessibilityLabel={t('monthLabel', { month: m.label, income: m.income, expenses: m.expenses })}
            className="h-full flex-1 items-center gap-1.5"
          >
            <TwView className="w-full flex-1 flex-row items-end justify-center gap-1">
              <TwView className="w-2.5 rounded-t-[3px] bg-income-70" style={{ height: `${Math.max(2, m.incomePercent)}%` }} />
              <TwView className="w-2.5 rounded-t-[3px] bg-expense-70" style={{ height: `${Math.max(2, m.expensePercent)}%` }} />
            </TwView>
            <Text className="text-[10px] text-on-surface-variant">{m.label}</Text>
          </TwView>
        ))}
      </TwView>
    </TwView>
  );
}
