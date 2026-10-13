import type { CalendarEvent } from '@finnit/ui/components/finance/calendar-day-cell';

import { dayInMonth, summarizeBalances } from '@/lib/finance/accounts';
import {
  firstDayOf,
  formatMonthParam,
  daysInMonth as monthDays,
  monthLabel,
  monthOf,
  parseDayKey,
  sameMonth,
  shiftMonth,
  weekdayIndex,
  type DayKey,
  type MonthRef,
} from '@/lib/finance/dates';
import { DEFAULT_CURRENCY, formatMoney, roundCents } from '@/lib/finance/money';
import { toPaymentRow, type PaymentRow } from '@/lib/finance/payments';
import type { ApiAccount, ApiUpcomingPayment } from '@/lib/finance/types';

export interface CalendarData {
  payments: ApiUpcomingPayment[];
  accounts: ApiAccount[];
  recurringTotals: { currency: string; monthlyCost: number }[];
  recurringCount: number;
}

export interface CardDate {
  id: string;
  label: string;
  kind: 'statement' | 'payment';
}

export interface CalendarDay {
  payments: PaymentRow[];
  cardDates: CardDate[];
}

export interface CalendarView {
  /** No recurring expenses and no card dates to show at all. */
  isEmpty: boolean;
  month: {
    label: string;
    prevHref: string;
    nextHref: string;
    leadingDays: number[];
    daysInMonth: number;
    /** Day of the month when the visible month is the current one. */
    today: number | null;
  };
  events: Record<number, CalendarEvent>;
  days: Record<number, CalendarDay>;
  monthPayments: PaymentRow[];
  totals: {
    /** Average monthly cost of active recurring expenses. */
    fixedMonthly: string;
    /** Still to pay this month. */
    open: string;
    openCount: number;
  };
}

const href = (m: MonthRef) => `/calendar?month=${formatMonthParam(m)}`;

export function buildCalendarView(
  data: CalendarData,
  { month, today }: { month: MonthRef; today: DayKey },
): CalendarView {
  const first = firstDayOf(month);
  const previous = shiftMonth(month, -1);
  const lead = weekdayIndex(first);
  const prevDays = monthDays(previous);
  const currency =
    summarizeBalances(data.accounts)[0]?.currency ??
    data.recurringTotals[0]?.currency ??
    DEFAULT_CURRENCY;

  const days: Record<number, CalendarDay> = {};
  const dayOf = (n: number) => (days[n] ??= { payments: [], cardDates: [] });

  const monthPayments = data.payments
    .map((p) => toPaymentRow(p, today))
    .filter((p) => sameMonth(monthOf(p.day), month));
  for (const row of monthPayments)
    dayOf(parseDayKey(row.day).day).payments.push(row);

  for (const account of data.accounts) {
    const terms = account.type === 'credit' ? account.creditCardTerms : null;
    if (!terms || account.archived) continue;
    dayOf(dayInMonth(month, terms.statementDay)).cardDates.push({
      id: `${account.id}:statement`,
      label: `Corte de ${account.name}`,
      kind: 'statement',
    });
    dayOf(dayInMonth(month, terms.paymentDueDay)).cardDates.push({
      id: `${account.id}:payment`,
      label: `Límite de pago de ${account.name}`,
      kind: 'payment',
    });
  }

  const events: Record<number, CalendarEvent> = {};
  for (const [n, day] of Object.entries(days)) {
    const [payment] = day.payments;
    events[Number(n)] = payment
      ? {
          label:
            day.payments.length === 1
              ? payment.title
              : `${day.payments.length} pagos`,
          accent: 'primary',
        }
      : {
          label:
            day.cardDates.length === 1
              ? day.cardDates[0]!.kind === 'statement'
                ? 'Corte'
                : 'Pago TDC'
              : 'Tarjetas',
          accent: 'neon',
        };
  }

  const openRows = data.payments.filter((p) => {
    const row = toPaymentRow(p, today);
    return row.open && sameMonth(monthOf(row.day), month);
  });
  const openTotal = roundCents(
    openRows
      .filter((p) => p.recurringExpense.currency === currency)
      .reduce((sum, p) => sum + p.expectedAmount, 0),
  );
  const fixed =
    data.recurringTotals.find((t) => t.currency === currency)?.monthlyCost ?? 0;

  const isToday = sameMonth(monthOf(today), month);
  return {
    isEmpty: data.recurringCount === 0 && Object.keys(days).length === 0,
    month: {
      label: monthLabel(month),
      prevHref: href(previous),
      nextHref: href(shiftMonth(month, 1)),
      leadingDays: Array.from(
        { length: lead },
        (_, i) => prevDays - lead + 1 + i,
      ),
      daysInMonth: monthDays(month),
      today: isToday ? parseDayKey(today).day : null,
    },
    events,
    days,
    monthPayments,
    totals: {
      fixedMonthly: formatMoney(fixed, currency),
      open: formatMoney(openTotal, currency),
      openCount: openRows.length,
    },
  };
}
