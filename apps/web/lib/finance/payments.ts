import type { IconKey } from './categories';
import {
  addDays,
  dayKeyOf,
  relativeDayLabel,
  shortDate,
  type DayKey,
} from './dates';
import { formatMoney } from './money';
import type { ApiUpcomingPayment, RecurringKind } from './types';

/** A recurring payment due on a day, ready for PaymentItem. */
export interface PaymentRow {
  id: string;
  title: string;
  amount: string;
  /** PaymentItem's look: pending stands out, scheduled is calm, paid is done. */
  status: 'pending' | 'scheduled' | 'paid';
  timeLabel: string;
  iconKey: IconKey;
  day: DayKey;
  /** Still to pay (not paid or skipped). */
  open: boolean;
}

const KIND_ICONS: Record<RecurringKind, IconKey> = {
  subscription: 'subscriptions',
  membership: 'subscriptions',
  utility: 'bills',
  loan: 'loan',
  installment: 'card',
  insurance: 'insurance',
  housing: 'housing',
  other: 'other',
};

/** Within this many days an open payment is highlighted as pending. */
const SOON_DAYS = 3;

export function toPaymentRow(
  payment: ApiUpcomingPayment,
  today: DayKey,
): PaymentRow {
  const day = dayKeyOf(payment.dueDate);
  const expense = payment.recurringExpense;
  const when = `${relativeDayLabel(day, today)} · ${shortDate(day)}`;
  const amount = formatMoney(payment.expectedAmount, expense.currency);
  const base = {
    id: `${expense.id}:${day}`,
    title: expense.name,
    amount: expense.isVariableAmount ? `≈ ${amount}` : amount,
    iconKey: KIND_ICONS[expense.kind] ?? 'other',
    day,
  };

  switch (payment.status) {
    case 'paid':
      return { ...base, status: 'paid', timeLabel: when, open: false };
    case 'skipped':
      return {
        ...base,
        status: 'scheduled',
        timeLabel: `Omitido · ${shortDate(day)}`,
        open: false,
      };
    case 'missed':
      return {
        ...base,
        status: 'pending',
        timeLabel: `Vencido · ${shortDate(day)}`,
        open: true,
      };
    default: {
      // upcoming, or a reminder-only expense (no status).
      const soon = day <= addDays(today, SOON_DAYS);
      return {
        ...base,
        status: soon ? 'pending' : 'scheduled',
        timeLabel: payment.status === null ? `Recordatorio · ${when}` : when,
        open: true,
      };
    }
  }
}
