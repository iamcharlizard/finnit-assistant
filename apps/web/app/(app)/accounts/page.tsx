import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { AccountsScreen } from '@/components/screens/accounts-screen';
import { loadAccounts } from '@/lib/accounts/load';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('pageTitles.cards') };
}

export default async function AccountsPage({
  searchParams,
}: PageProps<'/accounts'>) {
  // ?card= is the old /cards link.
  const { account, card, archived, add } = await searchParams;
  return (
    <AccountsScreen
      data={await loadAccounts({
        requested: account ?? card,
        showArchived: archived === '1',
      })}
      openWizard={add === '1'}
    />
  );
}
