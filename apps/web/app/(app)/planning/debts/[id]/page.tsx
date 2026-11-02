import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { LoanDetailScreen } from '@/components/debts/loan-detail-screen';
import { loadDebtDetail } from '@/lib/debts/load';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('pageTitles.debts') };
}

export default async function DebtPage({
  params,
}: PageProps<'/planning/debts/[id]'>) {
  const { id } = await params;
  return <LoanDetailScreen data={await loadDebtDetail(id)} />;
}
