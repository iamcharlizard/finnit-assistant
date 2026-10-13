import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { DashboardScreen } from '@/components/screens/dashboard-screen';
import { loadDashboard } from '@/lib/dashboard/load';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('pageTitles.dashboard') };
}

export default async function DashboardPage() {
  return <DashboardScreen view={await loadDashboard()} />;
}
