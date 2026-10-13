import type { Localizer } from '@/lib/i18n/translator';

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
  { locale, t }: Localizer,
): PaymentRow {
  const day = dayKeyOf(payment.dueDate);
  const expense = payment.recurringExpense;
  const date = shortDate(day, locale);
  const when = t('finance.payment.when', {
    relative: relativeDayLabel(day, today, locale),
    date,
  });
  const amount = formatMoney(payment.expectedAmount, expense.currency, locale);
  const base = {
    id: `${expense.id}:${day}`,
    title: expense.name,
    amount: expense.isVariableAmount
      ? t('finance.payment.approx', { amount })
      : amount,
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
        timeLabel: t('finance.payment.skipped', { date }),
        open: false,
      };
    case 'missed':
      return {
        ...base,
        status: 'pending',
        timeLabel: t('finance.payment.missed', { date }),
        open: true,
      };
    default: {
      // upcoming, or a reminder-only expense (no status).
      const soon = day <= addDays(today, SOON_DAYS);
      return {
        ...base,
        status: soon ? 'pending' : 'scheduled',
        timeLabel:
          payment.status === null
            ? t('finance.payment.reminder', { when })
            : when,
        open: true,
      };
    }
  }
}
