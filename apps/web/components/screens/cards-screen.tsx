'use client';

import { CreditCard, Inbox } from 'lucide-react';

import { StatCard } from '@finnit/ui/components/finance/stat-card';
import { SectionHeading } from '@finnit/ui/components/ui/section-heading';

import { CardBalance } from '@/components/cards/card-balance';
import { CardCarousel } from '@/components/cards/card-carousel';
import { CardFacts } from '@/components/cards/card-facts';
import { EmptyState } from '@/components/finance/empty-state';
import { TransactionRow } from '@/components/finance/transaction-row';
import { useSessionUser } from '@/components/session-provider';
import type { CardsData } from '@/lib/cards/load';

export function CardsScreen({ data }: { data: CardsData }) {
  const user = useSessionUser();
  const { cards, detail } = data;

  if (!detail) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-[22px] font-bold text-on-background">
          Mis Tarjetas
        </h1>
        <EmptyState
          icon={CreditCard}
          title="Aún no tienes tarjetas"
          description="Conecta tu banco para ver aquí tus tarjetas de crédito y débito, su saldo y sus fechas de corte."
          action={{ href: '/settings/banks/connect', label: 'Conectar banco' }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <div className="mb-3.5 flex items-end justify-between px-1">
          <h1 className="text-[22px] font-bold text-on-background">
            Mis Tarjetas
          </h1>
          <span className="text-[11px] font-medium uppercase tracking-[0.15em] text-on-surface-variant">
            {cards.length} {cards.length === 1 ? 'tarjeta' : 'tarjetas'}
          </span>
        </div>
        <CardCarousel
          cards={cards}
          selectedId={detail.card.id}
          holderName={user.name}
        />
      </section>

      <div className="grid gap-3.5 md:grid-cols-2 lg:grid-cols-3">
        <CardBalance card={detail.card} />
        <StatCard
          variant="expense"
          label={`Gastos · ${detail.monthLabel}`}
          amount={detail.monthSpending}
          className="min-h-44"
        />
        <CardFacts detail={detail} />
      </div>

      <section>
        <SectionHeading title={`Movimientos de ${detail.card.name}`} />
        {detail.recent.length > 0 ? (
          <div className="flex flex-col gap-2.5">
            {detail.recent.map((row) => (
              <TransactionRow key={row.id} row={row} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Inbox}
            title="Sin movimientos"
            description="Esta tarjeta aún no tiene movimientos."
          />
        )}
      </section>
    </div>
  );
}
