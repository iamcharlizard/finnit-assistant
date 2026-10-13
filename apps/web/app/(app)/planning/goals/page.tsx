import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { GoalsScreen } from '@/components/goals/goals-screen';
import { loadGoals } from '@/lib/goals/load';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('pageTitles.goals') };
}

export default async function GoalsPage({
  searchParams,
}: PageProps<'/planning/goals'>) {
  const { goal } = await searchParams;
  return <GoalsScreen view={await loadGoals(goal)} />;
}
