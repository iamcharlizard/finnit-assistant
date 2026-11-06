import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { CategorizeScreen } from '@/components/screens/categorize-screen';
import { parseCategorizeFilters } from '@finnit/core/categorize/filters';
import { loadCategorize } from '@/lib/categorize/load';
import { todayKey } from '@finnit/core/finance/dates';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('pageTitles.categorize') };
}

export default async function CategorizePage({
  searchParams,
}: PageProps<'/transactions/categorize'>) {
  const filters = parseCategorizeFilters(await searchParams, todayKey());
  return (
    <CategorizeScreen data={await loadCategorize(filters)} filters={filters} />
  );
}
