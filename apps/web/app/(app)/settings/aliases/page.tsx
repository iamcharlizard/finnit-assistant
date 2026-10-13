import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { AliasesScreen } from '@/components/screens/aliases-screen';
import { loadAliases } from '@/lib/aliases/load';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('pageTitles.aliases') };
}

export default async function AliasesPage() {
  return <AliasesScreen data={await loadAliases()} />;
}
