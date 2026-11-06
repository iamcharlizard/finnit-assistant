import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { CategoriesScreen } from '@/components/screens/categories-screen';
import { loadCategories } from '@/lib/categories/load';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('pageTitles.categories') };
}

export default async function CategoriesPage() {
  return <CategoriesScreen data={await loadCategories()} />;
}
