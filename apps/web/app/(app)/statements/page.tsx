import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { StatementsScreen } from '@/components/statements/statements-screen';
import { isUuid } from '@/lib/files/routes';
import { loadStatements } from '@/lib/statements/load';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('pageTitles.statements') };
}

export default async function StatementsPage({
  searchParams,
}: PageProps<'/statements'>) {
  // ?account= comes from the Accounts screen's "Subir estado de cuenta".
  const { account } = await searchParams;
  return (
    <StatementsScreen
      data={await loadStatements()}
      initialAccountId={isUuid(account) ? account : undefined}
    />
  );
}
