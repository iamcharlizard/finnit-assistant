import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { SettingsScreen } from '@/components/screens/settings-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('pageTitles.settings') };
}

export default function SettingsPage() {
  return <SettingsScreen />;
}
