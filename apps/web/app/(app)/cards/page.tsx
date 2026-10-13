import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { CardsScreen } from '@/components/screens/cards-screen';
import { loadCards } from '@/lib/cards/load';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('pageTitles.cards') };
}

export default async function CardsPage({ searchParams }: PageProps<'/cards'>) {
  const { card } = await searchParams;
  return <CardsScreen data={await loadCards(card)} />;
}
