import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { AdminUsersScreen } from '@/components/admin/admin-users-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('pageTitles.adminUsers') };
}

export default function AdminUsersPage() {
  return <AdminUsersScreen />;
}
