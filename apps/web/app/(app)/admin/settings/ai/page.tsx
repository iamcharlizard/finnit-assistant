import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { AdminAiScreen } from '@/components/admin/admin-ai-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('pageTitles.adminAi') };
}

export default function AdminAiPage() {
  return <AdminAiScreen />;
}
