import { useTranslations } from 'next-intl';
import { Gauge, PiggyBank, Sparkles } from 'lucide-react';

import { SummaryCard } from '@/components/recurring/summary-card';
import type { GoalsSummary as Summary } from '@/lib/goals/view';

const TEAL = '#00696e';
const GREEN = '#00a86b';
const PURPLE = '#6c72cb';

/** Totals across goals, from goalRecommendations. */
export function GoalsSummary({ summary }: { summary: Summary }) {
  const t = useTranslations('goals.summary');
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <SummaryCard
        icon={PiggyBank}
        accent={GREEN}
        label={t('saved')}
        amount={summary.saved}
        detail={t('savedDetail', {
          target: summary.target,
          count: summary.count,
        })}
      />
      <SummaryCard
        icon={Gauge}
        accent={TEAL}
        label={t('average')}
        amount={summary.averageProgress}
        detail={t('averageDetail')}
      />
      <SummaryCard
        icon={Sparkles}
        accent={PURPLE}
        label={t('recommended')}
        amount={summary.recommendedMonthly}
        detail={t('recommendedDetail')}
      />
    </div>
  );
}
