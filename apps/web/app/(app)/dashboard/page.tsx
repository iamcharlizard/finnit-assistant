import type { Metadata } from 'next';

import { DashboardScreen } from '@/components/screens/dashboard-screen';
import { loadDashboard } from '@/lib/dashboard/load';

export const metadata: Metadata = { title: 'Inicio' };

export default async function DashboardPage() {
  return <DashboardScreen view={await loadDashboard()} />;
}
