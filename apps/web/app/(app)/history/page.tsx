import type { Metadata } from 'next';

import { HistoryScreen } from '@/components/screens/history-screen';
import { parseHistoryFilters } from '@/lib/history/filters';
import { loadHistory } from '@/lib/history/load';

export const metadata: Metadata = { title: 'Historial' };

export default async function HistoryPage({
  searchParams,
}: PageProps<'/history'>) {
  const filters = parseHistoryFilters(await searchParams);
  return <HistoryScreen data={await loadHistory(filters)} filters={filters} />;
}
