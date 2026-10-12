import type { Metadata } from 'next';

import { DashboardScreen } from '@/components/screens/dashboard-screen';

export const metadata: Metadata = { title: 'Inicio' };

export default function DashboardPage() {
  return <DashboardScreen />;
}
