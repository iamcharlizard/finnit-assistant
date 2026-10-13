import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { HistoryScreen } from '@/components/screens/history-screen';
import { parseHistoryFilters } from '@/lib/history/filters';
import { loadHistory } from '@/lib/history/load';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('pageTitles.history') };
}

export default async function HistoryPage({
  searchParams,
}: PageProps<'/history'>) {
  const filters = parseHistoryFilters(await searchParams);
  return <HistoryScreen data={await loadHistory(filters)} filters={filters} />;
}
