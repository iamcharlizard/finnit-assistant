import type { Metadata } from 'next';

import { AnalyticsScreen } from '@/components/screens/analytics-screen';

export const metadata: Metadata = { title: 'Analytics' };

export default function AnalyticsPage() {
  return <AnalyticsScreen />;
}
