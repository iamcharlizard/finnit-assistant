import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { DashboardScreen } from '@/components/screens/dashboard-screen';
import { loadBudgetCard } from '@/lib/budgets/load';
import { loadDashboard } from '@/lib/dashboard/load';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('pageTitles.dashboard') };
}

export default async function DashboardPage() {
  const [view, budget] = await Promise.all([loadDashboard(), loadBudgetCard()]);
  return <DashboardScreen view={view} budget={budget} />;
}
