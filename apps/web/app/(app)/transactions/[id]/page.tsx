import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { TransactionDetailScreen } from '@/components/transaction-detail/transaction-detail-screen';
import { loadTransactionDetail } from '@/lib/transaction-detail/load';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('pageTitles.transaction') };
}

export default async function TransactionPage({
  params,
}: PageProps<'/transactions/[id]'>) {
  const { id } = await params;
  return <TransactionDetailScreen data={await loadTransactionDetail(id)} />;
}
