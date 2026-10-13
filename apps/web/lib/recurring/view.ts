import type { RecurringCalendarEvent } from '@finnit/ui/components/finance/recurring-calendar';

import {
  accountLabel,
  dayInMonth,
  summarizeBalances,
} from '@/lib/finance/accounts';
import { ICON_COLORS } from '@/lib/finance/categories';
import {
  dayKeyOf,
  monthOf,
  parseDayKey,
  relativeDayLabel,
  shortDate,
  type DayKey,
} from '@/lib/finance/dates';
import {
  DEFAULT_CURRENCY,
  formatMoney,
  percentOf,
  roundCents,
} from '@/lib/finance/money';
import { recurringKindIcon } from '@/lib/finance/payments';
import type { ApiAccount, RecurringKind } from '@/lib/finance/types';
import type { Localizer, Translate } from '@/lib/i18n/translator';
import type { PaymentAction } from './api';
import {
  daysOf,
  inRange,
  periodLabel,
  recurringHref,
  shiftDate,
  visibleRange,
  type DayRange,
  type RecurringView,
} from './range';
import type {
  ApiRecurringCategory,
  ApiRecurringExpense,
  ApiRecurringPayment,
  RecurringFrequency,
  RecurringTrackingMode,
} from './types';

export type PaymentStatus =
  | 'upcoming'
  | 'paid'
  | 'skipped'
  | 'missed'
  | 'reminder';

/** One due payment as the side panel and the calendar show it. */
export interface PaymentItem {
  key: string;
  occurrenceId: string | null;
  expenseId: string;
  name: string;
  kind: RecurringKind;
  trackingMode: RecurringTrackingMode;
  day: DayKey;
  /** "Mañana · 14 oct" */
  dateLabel: string;
  amount: number;
  currency: string;
  amountLabel: string;
  accountLabel: string | null;
  status: PaymentStatus;
  /** Still `upcoming` but its due date already passed. */
  overdue: boolean;
  /** Still to pay: upcoming, overdue, missed or a reminder. */
  open: boolean;
  actions: PaymentAction[];
}

export interface CardDateItem {
  id: string;
  day: DayKey;
  label: string;
  kind: 'statement' | 'payment';
}

export interface ExpenseItem {
  id: string;
  name: string;
  kind: RecurringKind;
  active: boolean;
  trackingMode: RecurringTrackingMode;
  frequencyLabel: string;
  amountLabel: string;
  /** "≈ $219.00 al mes" */
  monthlyLabel: string;
  monthlyCost: number;
  currency: string;
  nextDueLabel: string | null;
  accountLabel: string | null;
  categoryLabel: string | null;
  installments: { paid: number; total: number; percent: number } | null;
  expense: ApiRecurringExpense;
}

export interface RecurringData {
  payments: ApiRecurringPayment[];
  expenses: ApiRecurringExpense[];
  accounts: ApiAccount[];
  categories: ApiRecurringCategory[];
  monthlyTotals: { currency: string; monthlyCost: number }[];
}

export interface RecurringScreenView {
  view: RecurringView;
  date: DayKey;
  today: DayKey;
  range: DayRange;
  periodLabel: string;
  prevHref: string;
  nextHref: string;
  todayHref: string;
  events: RecurringCalendarEvent[];
  payments: PaymentItem[];
  cardDates: CardDateItem[];
  totals: {
    toPay: string;
    toPayCount: number;
    paid: string;
    paidCount: number;
    fixedMonthly: string;
    activeCount: number;
  };
  expenses: ExpenseItem[];
  accounts: ApiAccount[];
  categories: ApiRecurringCategory[];
  currency: string;
}

/**
 * The calendar status of a payment. An upcoming payment whose day already
 * passed shows as overdue ("Vencido") even before the API marks it missed
 * (it never does for automatic ones: they wait for the bank or statement).
 */
export function paymentStatus(
  payment: Pick<ApiRecurringPayment, 'status' | 'dueDate'>,
  today: DayKey,
): { status: PaymentStatus; overdue: boolean } {
  if (payment.status === null) return { status: 'reminder', overdue: false };
  if (payment.status === 'upcoming' && dayKeyOf(payment.dueDate) < today) {
    return { status: 'missed', overdue: true };
  }
  return { status: payment.status, overdue: false };
}

/** What can be done with a payment: reminders have no payment state. */
export function paymentActions(
  occurrenceId: string | null,
  status: PaymentStatus,
): PaymentAction[] {
  if (!occurrenceId || status === 'reminder') return [];
  if (status === 'paid' || status === 'skipped') return ['reopen'];
  return ['pay', 'skip'];
}

export function kindColor(kind: RecurringKind): string {
  return ICON_COLORS[recurringKindIcon(kind)];
}

export function toPaymentItem(
  payment: ApiRecurringPayment,
  accountsById: ReadonlyMap<string, ApiAccount>,
  today: DayKey,
  { locale, t }: Localizer,
): PaymentItem {
  const expense = payment.recurringExpense;
  const day = dayKeyOf(payment.dueDate);
  const { status, overdue } = paymentStatus(payment, today);
  const amount = formatMoney(payment.expectedAmount, expense.currency, locale);
  const account = expense.accountId
    ? accountsById.get(expense.accountId)
    : undefined;
  return {
    key: payment.occurrenceId ?? `${expense.id}:${day}`,
    occurrenceId: payment.occurrenceId,
    expenseId: expense.id,
    name: expense.name,
    kind: expense.kind,
    trackingMode: expense.trackingMode,
    day,
    dateLabel: t('finance.payment.when', {
      relative: relativeDayLabel(day, today, locale),
      date: shortDate(day, locale),
    }),
    amount: payment.expectedAmount,
    currency: expense.currency,
    amountLabel: expense.isVariableAmount
      ? t('finance.payment.approx', { amount })
      : amount,
    accountLabel: account ? accountLabel(account) : null,
    status,
    overdue,
    open: status !== 'paid' && status !== 'skipped',
    actions: paymentActions(payment.occurrenceId, status),
  };
}

export function toCalendarEvent(item: PaymentItem): RecurringCalendarEvent {
  return {
    id: item.key,
    date: item.day,
    title: item.name,
    amountLabel: item.amountLabel,
    status: item.status,
    color: kindColor(item.kind),
  };
}

/** "Mensual", "Cada 2 semanas", "Quincenal"… */
export function frequencyLabel(
  frequency: RecurringFrequency,
  interval: number,
  t: Translate,
): string {
  return interval > 1
    ? t(`recurring.frequencyEvery.${frequency}`, { interval })
    : t(`recurring.frequencyShort.${frequency}`);
}

export function toExpenseItem(
  expense: ApiRecurringExpense,
  {
    accountsById,
    categoriesById,
    today,
  }: {
    accountsById: ReadonlyMap<string, ApiAccount>;
    categoriesById: ReadonlyMap<string, ApiRecurringCategory>;
    today: DayKey;
  },
  { locale, t }: Localizer,
): ExpenseItem {
  const money = (n: number) => formatMoney(n, expense.currency, locale);
  const amount = money(expense.amount);
  const account = expense.accountId
    ? accountsById.get(expense.accountId)
    : undefined;
  const category = expense.categoryId
    ? categoriesById.get(expense.categoryId)
    : undefined;
  const next =
    expense.active && expense.nextDueDate
      ? dayKeyOf(expense.nextDueDate)
      : null;
  const total = expense.installmentsTotal;
  return {
    id: expense.id,
    name: expense.name,
    kind: expense.kind,
    active: expense.active,
    trackingMode: expense.trackingMode,
    frequencyLabel: frequencyLabel(expense.frequency, expense.interval, t),
    amountLabel: expense.isVariableAmount
      ? t('finance.payment.approx', { amount })
      : amount,
    monthlyLabel: t('recurring.list.perMonth', {
      amount: money(expense.monthlyCost),
    }),
    monthlyCost: expense.monthlyCost,
    currency: expense.currency,
    nextDueLabel: next
      ? t('recurring.list.next', {
          when: t('finance.payment.when', {
            relative: relativeDayLabel(next, today, locale),
            date: shortDate(next, locale),
          }),
        })
      : null,
    accountLabel: account ? accountLabel(account) : null,
    categoryLabel: category?.name ?? null,
    installments:
      expense.kind === 'installment' && total
        ? {
            paid: expense.installmentsPaid,
            total,
            percent: percentOf(expense.installmentsPaid, total),
          }
        : null,
    expense,
  };
}

/** Credit card cut-off and payment-due days that fall in the range. */
export function cardDatesIn(
  accounts: ReadonlyArray<ApiAccount>,
  range: DayRange,
  t: Translate,
): CardDateItem[] {
  const items: CardDateItem[] = [];
  for (const day of daysOf(range)) {
    const { day: dayOfMonth } = parseDayKey(day);
    const month = monthOf(day);
    for (const account of accounts) {
      const terms = account.type === 'credit' ? account.creditCardTerms : null;
      if (!terms || account.archived) continue;
      const name = accountLabel(account);
      if (dayInMonth(month, terms.statementDay) === dayOfMonth) {
        items.push({
          id: `${account.id}:statement:${day}`,
          day,
          label: t('recurring.cardDates.statement', { name }),
          kind: 'statement',
        });
      }
      if (dayInMonth(month, terms.paymentDueDay) === dayOfMonth) {
        items.push({
          id: `${account.id}:payment:${day}`,
          day,
          label: t('recurring.cardDates.paymentDue', { name }),
          kind: 'payment',
        });
      }
    }
  }
  return items;
}

/** Expenses by name, active first. */
function sortExpenses(a: ExpenseItem, b: ExpenseItem, locale: string) {
  return (
    Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, locale)
  );
}

export function buildRecurringView(
  data: RecurringData,
  { view, date, today }: { view: RecurringView; date: DayKey; today: DayKey },
  l: Localizer,
): RecurringScreenView {
  const { locale, t } = l;
  const range = visibleRange(view, date);
  const accountsById = new Map(data.accounts.map((a) => [a.id, a]));
  const categoriesById = new Map(data.categories.map((c) => [c.id, c]));
  const currency =
    data.monthlyTotals.find((x) => x.currency === DEFAULT_CURRENCY)?.currency ??
    summarizeBalances(data.accounts)[0]?.currency ??
    data.monthlyTotals[0]?.currency ??
    DEFAULT_CURRENCY;

  const payments = data.payments
    .map((p) => toPaymentItem(p, accountsById, today, l))
    .filter((p) => inRange(p.day, range))
    .sort(
      (a, b) =>
        a.day.localeCompare(b.day) || a.name.localeCompare(b.name, locale),
    );

  const sum = (items: PaymentItem[]) =>
    roundCents(
      items
        .filter((p) => p.currency === currency)
        .reduce((total, p) => total + p.amount, 0),
    );
  const open = payments.filter((p) => p.open);
  const paid = payments.filter((p) => p.status === 'paid');
  const fixed =
    data.monthlyTotals.find((x) => x.currency === currency)?.monthlyCost ?? 0;

  const expenses = data.expenses
    .map((e) => toExpenseItem(e, { accountsById, categoriesById, today }, l))
    .sort((a, b) => sortExpenses(a, b, locale));

  return {
    view,
    date,
    today,
    range,
    periodLabel: periodLabel(view, date, today, locale),
    prevHref: recurringHref({ view, date: shiftDate(view, date, -1) }),
    nextHref: recurringHref({ view, date: shiftDate(view, date, 1) }),
    todayHref: recurringHref({ view, date: today }),
    events: payments.map(toCalendarEvent),
    payments,
    cardDates: cardDatesIn(data.accounts, range, t),
    totals: {
      toPay: formatMoney(sum(open), currency, locale),
      toPayCount: open.length,
      paid: formatMoney(sum(paid), currency, locale),
      paidCount: paid.length,
      fixedMonthly: formatMoney(fixed, currency, locale),
      activeCount: expenses.filter((e) => e.active).length,
    },
    expenses,
    accounts: data.accounts.filter((a) => !a.archived),
    categories: data.categories,
    currency,
  };
}
