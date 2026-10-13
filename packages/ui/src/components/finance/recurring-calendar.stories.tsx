import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  addDaysToDateOnly,
  parseDateOnly,
  toDateOnly,
} from '../../lib/date-only';
import {
  RecurringCalendar,
  type RecurringCalendarEvent,
  type RecurringCalendarLabels,
  type RecurringCalendarProps,
  type RecurringCalendarView,
} from './recurring-calendar';

const TODAY = '2026-10-13';

const EVENTS: RecurringCalendarEvent[] = [
  {
    id: '1',
    date: '2026-10-01',
    title: 'Renta',
    amountLabel: '$12,000.00',
    status: 'paid',
    color: '#5B61C2',
  },
  {
    id: '2',
    date: '2026-10-05',
    title: 'Netflix',
    amountLabel: '$219.00',
    status: 'paid',
    color: '#BA1A1A',
  },
  {
    id: '3',
    date: '2026-10-05',
    title: 'Spotify',
    amountLabel: '$129.00',
    status: 'skipped',
    color: '#2B8A3E',
  },
  {
    id: '4',
    date: '2026-10-09',
    title: 'Gimnasio',
    amountLabel: '$650.00',
    status: 'missed',
    color: '#E8590C',
  },
  {
    id: '5',
    date: '2026-10-13',
    title: 'Luz (CFE)',
    amountLabel: '$480.00',
    status: 'reminder',
    color: '#F2B600',
  },
  {
    id: '6',
    date: '2026-10-13',
    title: 'Internet',
    amountLabel: '$599.00',
    status: 'upcoming',
    color: '#006688',
  },
  {
    id: '7',
    date: '2026-10-15',
    title: 'Tarjeta Nu',
    amountLabel: '$3,420.00',
    status: 'upcoming',
    color: '#9500CA',
  },
  {
    id: '8',
    date: '2026-10-15',
    title: 'Seguro auto',
    amountLabel: '$1,150.00',
    status: 'upcoming',
    color: '#00696E',
  },
  {
    id: '9',
    date: '2026-10-15',
    title: 'iCloud',
    amountLabel: '$49.00',
    status: 'upcoming',
  },
  {
    id: '10',
    date: '2026-10-15',
    title: 'Disney+',
    amountLabel: '$179.00',
    status: 'upcoming',
    color: '#0B3D91',
  },
  {
    id: '11',
    date: '2026-10-15',
    title: 'Agua',
    amountLabel: '$210.00',
    status: 'upcoming',
    color: '#3FA7D6',
  },
  {
    id: '12',
    date: '2026-10-28',
    title: 'Préstamo',
    amountLabel: '$2,500.00',
    status: 'upcoming',
    color: '#AD009B',
  },
];

const ES_LABELS: Partial<RecurringCalendarLabels> = {
  views: { day: 'Día', week: 'Semana', month: 'Mes' },
  viewSwitcher: 'Vista del calendario',
  today: 'Hoy',
  previous: 'Anterior',
  next: 'Siguiente',
  months: [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ],
  weekdays: [
    'domingo',
    'lunes',
    'martes',
    'miércoles',
    'jueves',
    'viernes',
    'sábado',
  ],
  weekdaysShort: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
  weekdaysNarrow: ['D', 'L', 'M', 'M', 'J', 'V', 'S'],
  status: {
    upcoming: 'Próximo',
    paid: 'Pagado',
    skipped: 'Omitido',
    missed: 'Vencido',
    reminder: 'Recordatorio',
  },
  more: (count) => `+${count} más`,
  eventCount: (count) => (count === 1 ? '1 pago' : `${count} pagos`),
  noEvents: 'Sin pagos este día.',
};

function shift(date: string, view: RecurringCalendarView, direction: 1 | -1) {
  if (view === 'day') return addDaysToDateOnly(date, direction);
  if (view === 'week') return addDaysToDateOnly(date, 7 * direction);
  const d = parseDateOnly(date)!;
  return toDateOnly(new Date(d.getFullYear(), d.getMonth() + direction, 1));
}

type ExampleProps = Pick<
  RecurringCalendarProps,
  'view' | 'labels' | 'weekStartsOn'
>;

function Interactive({
  view: initialView,
  labels,
  weekStartsOn,
}: ExampleProps) {
  const [view, setView] = React.useState(initialView);
  const [date, setDate] = React.useState(TODAY);
  const [lastEvent, setLastEvent] = React.useState<string>();

  return (
    <div className="flex flex-col gap-2">
      <RecurringCalendar
        view={view}
        onViewChange={setView}
        date={date}
        onSelectDate={setDate}
        onPrevious={() => setDate((d) => shift(d, view, -1))}
        onNext={() => setDate((d) => shift(d, view, 1))}
        onToday={() => setDate(TODAY)}
        onEventClick={(event) => setLastEvent(event.title)}
        today={TODAY}
        events={EVENTS}
        labels={labels}
        weekStartsOn={weekStartsOn}
      />
      <p className="text-xs text-on-surface-variant">
        date: <code>{date}</code>
        {lastEvent ? (
          <>
            {' '}
            · event: <code>{lastEvent}</code>
          </>
        ) : null}
      </p>
    </div>
  );
}

const meta = {
  title: 'Finance/RecurringCalendar',
  component: RecurringCalendar,
  args: { view: 'month', date: TODAY, today: TODAY, events: EVENTS },
  render: (args) => (
    <Interactive
      view={args.view}
      labels={args.labels}
      weekStartsOn={args.weekStartsOn}
    />
  ),
} satisfies Meta<typeof RecurringCalendar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Month: Story = {};
export const MonthSpanishMondayFirst: Story = {
  args: { labels: ES_LABELS, weekStartsOn: 1 },
};
export const Week: Story = {
  args: { view: 'week', labels: ES_LABELS, weekStartsOn: 1 },
};
export const Day: Story = { args: { view: 'day', labels: ES_LABELS } };
export const MobileWidth: Story = {
  args: { labels: ES_LABELS, weekStartsOn: 1 },
  decorators: [
    (Story) => (
      <div className="w-[390px] max-w-full">
        <Story />
      </div>
    ),
  ],
};
export const Light: Story = {
  args: { labels: ES_LABELS, weekStartsOn: 1 },
  parameters: { themes: { themeOverride: 'light' } },
};
export const Dark: Story = {
  args: { labels: ES_LABELS, weekStartsOn: 1 },
  parameters: { themes: { themeOverride: 'dark' } },
};
