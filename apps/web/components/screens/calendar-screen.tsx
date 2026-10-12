'use client';

import * as React from 'react';
import {
  ArrowDown,
  BriefcaseMedical,
  ChartLine,
  House,
  Landmark,
  ListFilter,
  Zap,
} from 'lucide-react';

import { AddPaymentCta } from '@finnit/ui/components/finance/add-payment-cta';
import { NeoTipCard } from '@finnit/ui/components/finance/neo-tip-card';
import {
  PaymentCalendar,
  type CalendarViewMode,
} from '@finnit/ui/components/finance/payment-calendar';
import { PaymentItem } from '@finnit/ui/components/finance/payment-item';
import { ProjectionCard } from '@finnit/ui/components/finance/projection-card';
import { Progress } from '@finnit/ui/components/ui/progress';
import { SectionHeading } from '@finnit/ui/components/ui/section-heading';

import { CALENDAR_EVENTS, CALENDAR_MONTH } from '@/lib/mocks/calendar';

const TEAL = '#00696e';
const PURPLE = '#6c72cb';

export function CalendarScreen() {
  const [viewMode, setViewMode] = React.useState<CalendarViewMode>('month');
  const [selectedDay, setSelectedDay] = React.useState<number | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="mb-1.5 text-[32px] leading-10 font-bold text-brand-ink">
          Calendario de Pagos
        </h1>
        <p className="text-[15px] text-on-surface-variant">
          Gestiona tus vencimientos y proyecta tu salud financiera.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-3">
          <PaymentCalendar
            monthLabel={CALENDAR_MONTH.label}
            leadingDays={CALENDAR_MONTH.leadingDays}
            daysInMonth={CALENDAR_MONTH.daysInMonth}
            today={CALENDAR_MONTH.today}
            events={CALENDAR_EVENTS}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />

          <div className="flex gap-2.5">
            <ProjectionCard
              label="Ahorro proyectado"
              amount="$2,450.00"
              icon={ChartLine}
              accentColor={TEAL}
            >
              <Progress
                value={75}
                glow
                indicatorColor={TEAL}
                className="mb-1.5"
                aria-label="75% de tu meta mensual"
              />
              <p className="text-[10px] text-on-surface-variant">
                75% de tu meta mensual
              </p>
            </ProjectionCard>
            <ProjectionCard
              label="Gastos fijos"
              amount="$1,120.40"
              icon={Landmark}
              accentColor={PURPLE}
            >
              <p className="flex items-center gap-1 text-[10px] text-on-surface-variant">
                <ArrowDown aria-hidden className="size-3 text-green-500" />
                5% menos que el mes pasado
              </p>
            </ProjectionCard>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <section>
            <SectionHeading
              title="Próximos Pagos"
              action={
                <button
                  type="button"
                  aria-label="Filtrar pagos"
                  className="flex size-11 items-center justify-center rounded-full text-brand-ink hover:bg-accent"
                >
                  <ListFilter aria-hidden className="size-5" />
                </button>
              }
            />
            <div className="flex flex-col gap-2">
              <PaymentItem
                title="Alquiler Octubre"
                amount="$850.00"
                status="pending"
                timeLabel="Hace 2 días"
                icon={House}
                iconBg={TEAL}
              />
              <PaymentItem
                title="Seguro Médico"
                amount="$120.00"
                status="scheduled"
                timeLabel="En 3 días"
                icon={BriefcaseMedical}
                iconBg={PURPLE}
              />
              <PaymentItem
                title="Servicio Eléctrico"
                amount="$45.50"
                status="paid"
                timeLabel="Ayer"
                icon={Zap}
                iconBg="rgba(0,0,0,0.08)"
                iconTint="#5c6370"
              />
            </div>
          </section>

          <AddPaymentCta />

          <NeoTipCard
            title="Consejo Finnit AI"
            body="Detectamos que tus suscripciones digitales han subido un 12%. Podrías ahorrar $15/mes cancelando servicios que no has usado en 30 días."
          />
        </div>
      </div>
    </div>
  );
}
