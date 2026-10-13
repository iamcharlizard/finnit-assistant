import type { Metadata } from 'next';

import { CardsScreen } from '@/components/screens/cards-screen';
import { loadCards } from '@/lib/cards/load';

export const metadata: Metadata = { title: 'Tarjetas' };

export default async function CardsPage({ searchParams }: PageProps<'/cards'>) {
  const { card } = await searchParams;
  return <CardsScreen data={await loadCards(card)} />;
}
