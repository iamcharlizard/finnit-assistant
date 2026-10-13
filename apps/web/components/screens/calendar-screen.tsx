'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CalendarClock, Landmark, Repeat } from 'lucide-react';

import { PaymentCalendar } from '@finnit/ui/components/finance/payment-calendar';
import { ProjectionCard } from '@finnit/ui/components/finance/projection-card';

import { DayAgenda } from '@/components/calendar/day-agenda';
import { EmptyState } from '@/components/finance/empty-state';
import type { CalendarView } from '@/lib/calendar/view';

const TEAL = '#00696e';
const PURPLE = '#6c72cb';

/** Monday-first, as PaymentCalendar lays out its columns. */
const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export function CalendarScreen({ view }: { view: CalendarView }) {
  const router = useRouter();
  const t = useTranslations('calendar');
  const tu = useTranslations('ui.paymentCalendar');
  const { month } = view;
  // Starts with the month's list; choosing a day narrows it.
  const [selectedDay, setSelectedDay] = React.useState<number | null>(null);
  const day = selectedDay ? view.days[selectedDay] : undefined;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="mb-1.5 text-[32px] leading-10 font-bold text-brand-ink">
          {t('title')}
        </h1>
        <p className="text-[15px] text-on-surface-variant">{t('subtitle')}</p>
      </header>

      {view.isEmpty ? (
        <EmptyState
          icon={Repeat}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
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
            dayHeaders={WEEKDAY_KEYS.map((day) => tu(`weekdays.${day}`))}
            prevLabel={tu('previousMonth')}
            nextLabel={tu('nextMonth')}
            ariaLabel={(label) => tu('label', { month: label })}
            viewModeLabels={{
              month: { label: tu('monthView'), aria: tu('monthViewLabel') },
              week: { label: tu('weekView'), aria: tu('weekViewLabel') },
            }}
          />

          <div className="flex gap-2.5">
            <ProjectionCard
              label={t('dueIn', { month: month.name })}
              amount={view.totals.open}
              icon={CalendarClock}
              accentColor={TEAL}
            >
              <p className="text-[10px] text-on-surface-variant">
                {t('pendingCount', { count: view.totals.openCount })}
              </p>
            </ProjectionCard>
            <ProjectionCard
              label={t('fixedMonthly')}
              amount={view.totals.fixedMonthly}
              icon={Landmark}
              accentColor={PURPLE}
            >
              <p className="text-[10px] text-on-surface-variant">
                {t('fixedMonthlyHint')}
              </p>
            </ProjectionCard>
          </div>
        </div>

        {selectedDay ? (
          <DayAgenda
            title={t('dayTitle', {
              day: String(selectedDay),
              month: month.name,
            })}
            payments={day?.payments ?? []}
            cardDates={day?.cardDates ?? []}
            emptyText={t('nothingDue')}
            onShowMonth={() => setSelectedDay(null)}
          />
        ) : (
          <DayAgenda
            title={t('monthPayments', { month: month.name })}
            payments={view.monthPayments}
            cardDates={[]}
            emptyText={t('noMonthPayments')}
          />
        )}
      </div>
    </div>
  );
}
