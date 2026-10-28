import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { ManualAccountLink } from '@/components/accounts/manual-account-link';
import { ConnectBankFlow } from '@/components/bank-connect/connect-bank-flow';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('pageTitles.connectBank') };
}

export default function ConnectBankPage() {
  return (
    <div className="flex flex-col gap-4">
      <ConnectBankFlow />
      <ManualAccountLink />
    </div>
  );
}
