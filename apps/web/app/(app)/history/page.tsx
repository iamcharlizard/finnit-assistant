import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { HistoryScreen } from '@/components/screens/history-screen';
import { parseHistoryFilters, parseShown } from '@finnit/core/history/filters';
import { loadHistory } from '@/lib/history/load';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('pageTitles.history') };
}

export default async function HistoryPage({
  searchParams,
}: PageProps<'/history'>) {
  const params = await searchParams;
  const filters = parseHistoryFilters(params);
  // ?n= brings back every row that was loaded (after an edit, a reload).
  return (
    <HistoryScreen
      data={await loadHistory(filters, parseShown(params))}
      filters={filters}
    />
  );
}
