'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock, Landmark, Repeat } from 'lucide-react';

import { PaymentCalendar } from '@finnit/ui/components/finance/payment-calendar';
import { ProjectionCard } from '@finnit/ui/components/finance/projection-card';

import { DayAgenda } from '@/components/calendar/day-agenda';
import { EmptyState } from '@/components/finance/empty-state';
import type { CalendarView } from '@/lib/calendar/view';

const TEAL = '#00696e';
const PURPLE = '#6c72cb';

export function CalendarScreen({ view }: { view: CalendarView }) {
  const router = useRouter();
  const { month } = view;
  // Starts with the month's list; choosing a day narrows it.
  const [selectedDay, setSelectedDay] = React.useState<number | null>(null);
  const monthName = month.label.split(' ')[0]!.toLowerCase();
  const day = selectedDay ? view.days[selectedDay] : undefined;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="mb-1.5 text-[32px] leading-10 font-bold text-brand-ink">
          Calendario de Pagos
        </h1>
        <p className="text-[15px] text-on-surface-variant">
          Tus pagos recurrentes y las fechas de tus tarjetas.
        </p>
      </header>

      {view.isEmpty ? (
        <EmptyState
          icon={Repeat}
          title="Aún no tienes pagos recurrentes"
          description="Cuando registres tus gastos recurrentes (suscripciones, servicios, mensualidades) verás aquí cuándo vence cada uno."
        />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <PaymentCalendar
            monthLabel={month.label}
            leadingDays={month.leadingDays}
            daysInMonth={month.daysInMonth}
            today={month.today ?? undefined}
            events={view.events}
            selectedDay={selectedDay}
            onSelectDay={(d) => setSelectedDay((s) => (s === d ? null : d))}
            showViewModes={false}
            onPrevMonth={() => router.push(month.prevHref, { scroll: false })}
            onNextMonth={() => router.push(month.nextHref, { scroll: false })}
          />

          <div className="flex gap-2.5">
            <ProjectionCard
              label={`Por pagar en ${monthName}`}
              amount={view.totals.open}
              icon={CalendarClock}
              accentColor={TEAL}
            >
              <p className="text-[10px] text-on-surface-variant">
                {view.totals.openCount === 1
                  ? '1 pago pendiente'
                  : `${view.totals.openCount} pagos pendientes`}
              </p>
            </ProjectionCard>
            <ProjectionCard
              label="Gastos fijos al mes"
              amount={view.totals.fixedMonthly}
              icon={Landmark}
              accentColor={PURPLE}
            >
              <p className="text-[10px] text-on-surface-variant">
                Promedio de tus gastos recurrentes
              </p>
            </ProjectionCard>
          </div>
        </div>

        {selectedDay ? (
          <DayAgenda
            title={`${selectedDay} de ${monthName}`}
            payments={day?.payments ?? []}
            cardDates={day?.cardDates ?? []}
            emptyText="Nada vence este día"
            onShowMonth={() => setSelectedDay(null)}
          />
        ) : (
          <DayAgenda
            title={`Pagos de ${monthName}`}
            payments={view.monthPayments}
            cardDates={[]}
            emptyText="Sin pagos este mes"
          />
        )}
      </div>
    </div>
  );
}
