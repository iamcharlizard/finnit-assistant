import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { AccountsScreen } from '@/components/screens/accounts-screen';
import { loadAccounts } from '@/lib/accounts/load';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('pageTitles.cards') };
}

/** One account's detail across the whole width, without the other cards. */
export default async function AccountPage({
  params,
  searchParams,
}: PageProps<'/accounts/[accountId]'>) {
  const [{ accountId }, { day }] = await Promise.all([params, searchParams]);
  // Archived accounts have their page too.
  const data = await loadAccounts({
    requested: accountId,
    showArchived: true,
    day,
  });
  // loadAccounts falls back to the first account; this page is for one.
  if (data.detail?.account.id !== accountId) notFound();
  return <AccountsScreen data={data} focused />;
}
