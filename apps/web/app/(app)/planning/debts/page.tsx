import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { DebtsScreen } from '@/components/debts/debts-screen';
import { loadDebts, parseDebtTab } from '@/lib/debts/load';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('pageTitles.debts') };
}

export default async function DebtsPage({
  searchParams,
}: PageProps<'/planning/debts'>) {
  const { tab } = await searchParams;
  return (
    <DebtsScreen data={await loadDebts()} initialTab={parseDebtTab(tab)} />
  );
}
