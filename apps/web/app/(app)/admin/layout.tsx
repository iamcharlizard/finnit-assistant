import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { TitleLg } from '@finnit/ui/components/ui/typography';

import { AdminTabs } from '@/components/admin/admin-tabs';
import { getCurrentUser, isAdmin } from '@/lib/auth/session';

/**
 * /admin exists only for admins: everyone else gets a plain 404. The API
 * checks the role again on every admin query and mutation.
 */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  if (!isAdmin(user)) notFound();
  const t = await getTranslations();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TitleLg as="h1">{t('admin.title')}</TitleLg>
        <AdminTabs />
      </div>
      {children}
    </div>
  );
}
