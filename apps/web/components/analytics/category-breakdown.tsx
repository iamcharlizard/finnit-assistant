'use client';

import { useTranslations } from 'next-intl';
import { PieChart } from 'lucide-react';

import { CategoryProgressItem } from '@finnit/ui/components/finance/category-progress-item';

import { EmptyState } from '@/components/finance/empty-state';
import type { AnalyticsView } from '@/lib/analytics/view';
import { CATEGORY_ICONS } from '@/lib/finance/category-icons';

/** The month's spending by category; bars are the share of the total. */
export function CategoryBreakdown({
  categories,
}: {
  categories: AnalyticsView['categories'];
}) {
  const t = useTranslations('analytics');
  if (categories.length === 0) {
    return (
      <EmptyState
        icon={PieChart}
        title={t('noSpendingTitle')}
        description={t('noSpendingDescription')}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {categories.map((c) => (
        <CategoryProgressItem
          key={c.id}
          label={t('categoryShare', {
            label: c.label,
            percent: String(c.percent),
          })}
          amount={c.amount}
          progressPercent={c.percent}
          icon={CATEGORY_ICONS[c.iconKey]}
          accentColor={c.color}
        />
      ))}
    </div>
  );
}
