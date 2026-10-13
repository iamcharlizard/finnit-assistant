'use client';

import { useRouter } from 'next/navigation';

import { BankPaymentCard } from '@finnit/ui/components/finance/bank-payment-card';
import { cn } from '@finnit/ui/lib/utils';

import type { CardSummary } from '@/lib/cards/view';

/** The user's cards; choosing one shows its details below (?card=…). */
export function CardCarousel({
  cards,
  selectedId,
  holderName,
}: {
  cards: CardSummary[];
  selectedId: string | null;
  holderName: string;
}) {
  const router = useRouter();

  return (
    <div
      aria-label="Carrusel de tarjetas"
      className="-mx-4 flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-4 pt-1 pb-4 sm:mx-0 sm:px-0 [scrollbar-width:none]"
    >
      {cards.map((card) => (
        <div
          key={card.id}
          className="w-[84vw] shrink-0 snap-start sm:w-[360px]"
        >
          <BankPaymentCard
            variant={card.variant}
            cardTier={card.tier}
            bankName={card.bankName ?? card.name}
            maskedNumber={card.maskedNumber}
            holderName={holderName.toUpperCase()}
            onClick={() =>
              router.push(`/cards?card=${encodeURIComponent(card.id)}`, {
                scroll: false,
              })
            }
            className={cn(
              'max-w-none',
              card.id === selectedId && 'ring-[3px] ring-brand/60',
            )}
          />
          <p className="mt-2 truncate px-1 text-xs text-on-surface-variant">
            {card.name}
            {card.id === selectedId ? ' · Seleccionada' : ''}
          </p>
        </div>
      ))}
    </div>
  );
}
