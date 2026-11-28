import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { AdminBankSyncCard } from '@/components/admin/admin-bank-sync-card';
import {
  GLOBAL_SETTINGS_QUERY,
  type GlobalSettingsData,
} from '@/lib/admin/global-settings';
import { serverGraphql } from '@/lib/api/server-graphql';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('pageTitles.adminBanks') };
}

/** /admin/settings/banks: the bank sync switch for the whole platform. */
export default async function AdminBankSyncPage() {
  const data = await serverGraphql<GlobalSettingsData>(GLOBAL_SETTINGS_QUERY);
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <AdminBankSyncCard initial={data.globalSettings} />
    </div>
  );
}
