import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { BodyMd } from '@finnit/ui/components/ui/typography';

import { WaitlistTable } from '@/components/admin/waitlist-table';
import {
  WAITLIST_QUERY,
  waitlistRows,
  type WaitlistData,
} from '@/lib/admin/waitlist';
import { serverGraphql } from '@/lib/api/server-graphql';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('pageTitles.adminWaitlist') };
}

/** /admin/waitlist: the emails left on the landing page (admins only). */
export default async function AdminWaitlistPage() {
  const [data, t] = await Promise.all([
    serverGraphql<WaitlistData>(WAITLIST_QUERY),
    getTranslations('admin.waitlist'),
  ]);
  return (
    <div className="flex flex-col gap-4">
      <BodyMd className="text-on-surface-variant">
        {t('summary', { count: data.waitlistEntries.totalCount })}
      </BodyMd>
      <WaitlistTable rows={waitlistRows(data)} />
    </div>
  );
}
