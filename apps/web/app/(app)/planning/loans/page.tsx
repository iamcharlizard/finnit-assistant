import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { LoansScreen } from '@/components/debts/loans-screen';
import { loadLoans } from '@/lib/debts/load';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('pageTitles.loans') };
}

export default async function LoansPage() {
  return <LoansScreen data={await loadLoans()} />;
}
