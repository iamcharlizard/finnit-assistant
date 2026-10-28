import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { AnalyticsScreen } from '@/components/screens/analytics-screen';
import { currentMonth, loadAnalytics } from '@/lib/analytics/load';
import { formatMonthParam, parseMonthParam } from '@/lib/finance/dates';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('pageTitles.analytics') };
}

export default async function AnalyticsPage({
  searchParams,
}: PageProps<'/analytics'>) {
  const current = currentMonth();
  const requested = parseMonthParam((await searchParams).month, current);
  // No future months: they have no data yet.
  const selected =
    formatMonthParam(requested) > formatMonthParam(current)
      ? current
      : requested;
  return <AnalyticsScreen view={await loadAnalytics(selected)} />;
}
