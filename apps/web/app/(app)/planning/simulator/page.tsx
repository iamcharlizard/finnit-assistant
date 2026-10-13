import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { SimulatorScreen } from '@/components/simulator/simulator-screen';
import { loadSimulator } from '@/lib/simulator/load';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('pageTitles.simulator') };
}

export default async function SimulatorPage() {
  return <SimulatorScreen data={await loadSimulator()} />;
}
