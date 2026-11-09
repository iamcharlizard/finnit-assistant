import {
  isDayKey,
  parseDayKey,
  daysInMonth,
  type DayKey,
} from '../finance/dates';
import { roundCents } from '../finance/money';
import type { ApiAccount } from '../finance/types';
import { parseAmount } from '../new-entry/form';
import { MAX_AMOUNT, NAME_MAX, parseRate } from './form';
import { MAX_ANNUAL_RATE } from './loan-form';
import { previewLoanTerms, type LoanTermsPreview } from './loan-terms';
import type { LoanInterestMode } from './types';

/**
 * A purchase on a credit card paid in monthly installments (meses con o
 * sin intereses): its form, the cut-offs that bill each installment and
 * the API input. Mirrors apps/api/src/modules/debts/card-installments.ts:
 * the first installment is billed on the cut-off of the cycle the purchase
 * falls in, then one per cut-off; without the card's terms, a month after
 * the purchase and monthly on that day.
 */

export interface CardCutTerms {
  statementDay: number;
}

/** Common terms of card purchases, in months. */
export const INSTALLMENT_MONTHS = [3, 6, 9, 12, 18, 24] as const;
export const MAX_MONTHS = 60;

const pad = (n: number) => String(n).padStart(2, '0');

/** `day` of a month (1-based, may overflow the year), clamped to its length. */
function dayOfMonth(year: number, month: number, day: number): DayKey {
  const y = year + Math.floor((month - 1) / 12);
  const m = ((((month - 1) % 12) + 12) % 12) + 1;
  const last = daysInMonth({ year: y, month: m });
  return `${y}-${pad(m)}-${pad(Math.min(day, last))}`;
}

/** The cut-off of the cycle that contains `day`. */
export function statementOn(day: DayKey, terms: CardCutTerms): DayKey {
  const { year, month } = parseDayKey(day);
  const cut = dayOfMonth(year, month, terms.statementDay);
  return day <= cut ? cut : dayOfMonth(year, month + 1, terms.statementDay);
}

/** The days `count` installments are billed, oldest first. */
export function installmentDays(
  purchase: DayKey,
  count: number,
  terms: CardCutTerms | null,
): DayKey[] {
  const days: DayKey[] = [];
  const { year, month, day: date } = parseDayKey(purchase);
  for (let i = 0; i < count; i++) {
    if (terms) {
      const first = statementOn(purchase, terms);
      const start = parseDayKey(first);
      days.push(dayOfMonth(start.year, start.month + i, terms.statementDay));
    } else {
      days.push(dayOfMonth(year, month + 1 + i, date));
    }
  }
  return days;
}

/** Installments already billed on `today` (their cut-off came). */
export function billedInstallments(
  purchase: DayKey,
  count: number,
  terms: CardCutTerms | null,
  today: DayKey,
): number {
  return installmentDays(purchase, count, terms).filter((d) => d <= today)
    .length;
}

/** The card's cut-off day, when it has its terms. */
export function cardTermsOf(
  card: Pick<ApiAccount, 'creditCardTerms'> | undefined,
): CardCutTerms | null {
  return card?.creditCardTerms
    ? { statementDay: card.creditCardTerms.statementDay }
    : null;
}

/** Credit cards that can pay a purchase in installments. */
export function installmentCards(accounts: ReadonlyArray<ApiAccount>) {
  return accounts.filter((a) => a.type === 'credit' && !a.archived);
}

// Form

export interface CardInstallmentForm {
  name: string;
  /** The card ('' until chosen). */
  accountId: string;
  /** The whole purchase. */
  principal: string;
  /** Number of monthly installments, as typed. */
  months: string;
  withInterest: boolean;
  /** With interest: how it is known (rate, total or installment). */
  interestMode: LoanInterestMode;
  rate: string;
  includesVat: boolean;
  totalToRepay: string;
  installmentAmount: string;
  /** 'YYYY-MM-DD'. */
  purchaseDate: string;
  /** Installments already billed, as typed. */
  installmentsPaid: string;
  /** The user typed the installments billed: stop working them out. */
  paidTouched: boolean;
  /** The card's expense of the whole purchase ('' = none). */
  purchaseTransactionId: string;
  /**
   * The installments as the user changed them (day and raw amount, e.g.
   * "332.66"); null = on the card's cut-offs, split evenly. Changing the
   * total, months, date, card or interest starts them over.
   */
  schedule: ScheduleRow[] | null;
}

export interface ScheduleRow {
  day: DayKey;
  amount: string;
}

export type CardInstallmentField = keyof CardInstallmentForm;

export type CardInstallmentErrorCode =
  | 'nameRequired'
  | 'nameTooLong'
  | 'accountRequired'
  | 'principalRequired'
  | 'principalInvalid'
  | 'principalTooLarge'
  | 'monthsRequired'
  | 'monthsInvalid'
  | 'purchaseDateRequired'
  | 'purchaseDateInFuture'
  | 'rateRequired'
  | 'rateInvalid'
  | 'totalRequired'
  | 'totalBelowPrincipal'
  | 'installmentAmountRequired'
  | 'installmentAmountTooLow'
  | 'installmentsPaidInvalid'
  | 'installmentsPaidTooMany'
  | 'scheduleDates'
  | 'scheduleAmounts'
  | 'scheduleBelowPrincipal';

export type CardInstallmentErrors = Partial<
  Record<CardInstallmentField, CardInstallmentErrorCode>
>;

export interface CardInstallmentPrefill {
  name?: string;
  accountId?: string;
  principal?: string;
  purchaseDate?: string;
  purchaseTransactionId?: string;
}

export function newCardInstallmentForm(
  today: DayKey,
  prefill: CardInstallmentPrefill = {},
): CardInstallmentForm {
  return {
    name: prefill.name ?? '',
    accountId: prefill.accountId ?? '',
    principal: prefill.principal ?? '',
    months: '',
    withInterest: false,
    interestMode: 'rate',
    rate: '',
    includesVat: true,
    totalToRepay: '',
    installmentAmount: '',
    purchaseDate: prefill.purchaseDate ?? today,
    installmentsPaid: '0',
    paidTouched: false,
    purchaseTransactionId: prefill.purchaseTransactionId ?? '',
    schedule: null,
  };
}

/** What starts the installments over when it changes. */
const SCHEDULE_INPUTS: ReadonlyArray<keyof CardInstallmentForm> = [
  'accountId',
  'principal',
  'months',
  'withInterest',
  'interestMode',
  'rate',
  'includesVat',
  'totalToRepay',
  'installmentAmount',
  'purchaseDate',
];

/**
 * Moves installment `index` to `day`; with `following`, the ones after it
 * go to that same day of the next months (as the API does).
 */
export function moveInstallment(
  days: readonly DayKey[],
  index: number,
  day: DayKey,
  following: boolean,
): DayKey[] {
  const next = [...days];
  next[index] = day;
  if (!following) return next;
  const { year, month, day: date } = parseDayKey(day);
  for (let j = index + 1; j < next.length; j++) {
    next[j] = dayOfMonth(year, month + (j - index), date);
  }
  return next;
}

/**
 * The installments the form will save: as the user changed them, or on
 * the card's cut-offs with the terms' amounts (the last takes the cents
 * left). Null while the total, months or date are missing.
 */
export function cardScheduleRows(
  form: CardInstallmentForm,
  accounts: ReadonlyArray<ApiAccount>,
): ScheduleRow[] | null {
  if (form.schedule) return form.schedule;
  const months = wholeNumber(form.months);
  const preview = cardInstallmentPreview(form);
  if (
    !months ||
    months > MAX_MONTHS ||
    !preview ||
    !isDayKey(form.purchaseDate)
  ) {
    return null;
  }
  const terms = cardTermsOf(accounts.find((a) => a.id === form.accountId));
  const each = preview.installmentAmount;
  const last = roundCents(preview.totalToRepay - each * (months - 1));
  return installmentDays(form.purchaseDate, months, terms).map((day, i) => ({
    day,
    amount: (i === months - 1 ? last : each).toFixed(2),
  }));
}

/**
 * One installment changed in the list: a new day moves the next ones to
 * that day of the following months; a new amount changes only that one.
 */
export function withScheduleRowChange(
  form: CardInstallmentForm,
  index: number,
  patch: Partial<ScheduleRow>,
  { accounts, today }: { accounts: ReadonlyArray<ApiAccount>; today: DayKey },
): CardInstallmentForm {
  const rows = cardScheduleRows(form, accounts);
  if (!rows) return form;
  const days = patch.day
    ? moveInstallment(
        rows.map((r) => r.day),
        index,
        patch.day,
        true,
      )
    : rows.map((r) => r.day);
  const schedule = rows.map((row, i) => ({
    day: days[i]!,
    amount:
      i === index && patch.amount !== undefined ? patch.amount : row.amount,
  }));
  return withCardInstallmentChange(form, { schedule }, { accounts, today });
}

/** One page of a long list of installments (12 or 24 months). */
export const SCHEDULE_PAGE = 6;

export function schedulePage<T>(
  rows: readonly T[],
  page: number,
): { rows: T[]; start: number; pages: number } {
  const pages = Math.max(1, Math.ceil(rows.length / SCHEDULE_PAGE));
  const current = Math.min(Math.max(0, page), pages - 1);
  const start = current * SCHEDULE_PAGE;
  return { rows: rows.slice(start, start + SCHEDULE_PAGE), start, pages };
}

const wholeNumber = (text: string): number | null =>
  /^\d+$/.test(text.trim()) ? Number(text.trim()) : null;

/**
 * The form after a change: while the user hasn't typed the installments
 * already billed, they follow the purchase date, the months and the card.
 */
export function withCardInstallmentChange(
  form: CardInstallmentForm,
  patch: Partial<CardInstallmentForm>,
  { accounts, today }: { accounts: ReadonlyArray<ApiAccount>; today: DayKey },
): CardInstallmentForm {
  const restart = SCHEDULE_INPUTS.some((key) => key in patch);
  const next = {
    ...form,
    ...patch,
    ...(restart && !('schedule' in patch) ? { schedule: null } : {}),
    ...('installmentsPaid' in patch ? { paidTouched: true } : {}),
  };
  if (next.paidTouched) return next;
  // The days alone say what was billed (the amounts may still be missing).
  const months = wholeNumber(next.months);
  const days = next.schedule
    ? next.schedule.map((r) => r.day)
    : months && months <= MAX_MONTHS && isDayKey(next.purchaseDate)
      ? installmentDays(
          next.purchaseDate,
          months,
          cardTermsOf(accounts.find((a) => a.id === next.accountId)),
        )
      : null;
  if (!days) return { ...next, installmentsPaid: '0' };
  const billed = days.filter((d) => d <= today).length;
  return { ...next, installmentsPaid: String(billed) };
}

/** The terms the API will store, or null while a value is missing. */
export function cardInstallmentPreview(
  form: CardInstallmentForm,
): LoanTermsPreview | null {
  const principal = parseAmount(form.principal) ?? 0;
  const months = wholeNumber(form.months) ?? 0;
  if (form.schedule) {
    const amounts = form.schedule.map((r) => parseAmount(r.amount) ?? 0);
    const total = roundCents(amounts.reduce((sum, a) => sum + a, 0));
    return {
      installmentAmount: amounts[0] ?? 0,
      totalToRepay: total,
      interest: roundCents(total - principal),
      fees: 0,
    };
  }
  if (!form.withInterest) {
    return previewLoanTerms({
      mode: 'total_amount',
      principal,
      installments: months,
      frequency: 'monthly',
      totalToRepay: principal,
    });
  }
  return previewLoanTerms({
    mode: form.interestMode,
    principal,
    installments: months,
    frequency: 'monthly',
    annualRate: form.rate.trim() ? parseRate(form.rate) : null,
    includesVat: form.includesVat,
    totalToRepay: parseAmount(form.totalToRepay),
    installmentAmount: parseAmount(form.installmentAmount),
  });
}

/** The first and last cut-offs that bill it. */
export function cardInstallmentSpan(
  form: CardInstallmentForm,
  accounts: ReadonlyArray<ApiAccount>,
): { first: DayKey; last: DayKey } | null {
  const rows = cardScheduleRows(form, accounts);
  if (!rows || rows.length === 0) return null;
  return { first: rows[0]!.day, last: rows[rows.length - 1]!.day };
}

export function validateCardInstallmentForm(
  form: CardInstallmentForm,
  { today }: { today: DayKey },
): CardInstallmentErrors {
  const errors: CardInstallmentErrors = {};
  const name = form.name.trim();
  if (!name) errors.name = 'nameRequired';
  else if (name.length > NAME_MAX) errors.name = 'nameTooLong';
  if (!form.accountId) errors.accountId = 'accountRequired';

  const principal = parseAmount(form.principal);
  if (!form.principal.trim()) errors.principal = 'principalRequired';
  else if (principal === null || principal <= 0) {
    errors.principal = 'principalInvalid';
  } else if (principal > MAX_AMOUNT) errors.principal = 'principalTooLarge';

  const months = wholeNumber(form.months);
  if (!form.months.trim()) errors.months = 'monthsRequired';
  else if (!months || months < 1 || months > MAX_MONTHS) {
    errors.months = 'monthsInvalid';
  }

  if (!isDayKey(form.purchaseDate))
    errors.purchaseDate = 'purchaseDateRequired';
  else if (form.purchaseDate > today) {
    errors.purchaseDate = 'purchaseDateInFuture';
  }

  if (form.withInterest) {
    if (form.interestMode === 'rate') {
      const rate = form.rate.trim() ? parseRate(form.rate) : null;
      if (!form.rate.trim()) errors.rate = 'rateRequired';
      else if (rate === null || rate <= 0 || rate > MAX_ANNUAL_RATE) {
        errors.rate = 'rateInvalid';
      }
    } else if (form.interestMode === 'total_amount') {
      const total = parseAmount(form.totalToRepay);
      if (total === null || total <= 0) errors.totalToRepay = 'totalRequired';
      else if (principal !== null && total < principal) {
        errors.totalToRepay = 'totalBelowPrincipal';
      }
    } else {
      const amount = parseAmount(form.installmentAmount);
      if (amount === null || amount <= 0) {
        errors.installmentAmount = 'installmentAmountRequired';
      } else if (
        principal !== null &&
        months &&
        roundCents(amount * months) < principal
      ) {
        errors.installmentAmount = 'installmentAmountTooLow';
      }
    }
  }

  if (form.schedule) {
    const amounts = form.schedule.map((r) => parseAmount(r.amount));
    if (amounts.some((a) => a === null || a <= 0)) {
      errors.schedule = 'scheduleAmounts';
    } else if (
      form.schedule.some(
        (r, i) =>
          (isDayKey(form.purchaseDate) && r.day < form.purchaseDate) ||
          (i > 0 && r.day <= form.schedule![i - 1]!.day),
      )
    ) {
      errors.schedule = 'scheduleDates';
    } else if (
      principal !== null &&
      roundCents(amounts.reduce((s, a) => s! + a!, 0)!) < principal - 0.001
    ) {
      errors.schedule = 'scheduleBelowPrincipal';
    }
  }

  const paid = wholeNumber(form.installmentsPaid || '0');
  if (paid === null) errors.installmentsPaid = 'installmentsPaidInvalid';
  else if (months && paid > months) {
    errors.installmentsPaid = 'installmentsPaidTooMany';
  }
  return errors;
}

/** CreateDebtInput of a valid form. */
export function buildCardInstallmentInput(
  form: CardInstallmentForm,
): Record<string, unknown> {
  const principal = parseAmount(form.principal)!;
  const input: Record<string, unknown> = {
    name: form.name.trim(),
    kind: 'loan',
    loanType: 'card_installments',
    principal,
    linkedAccountId: form.accountId,
    startDate: form.purchaseDate,
    installmentsTotal: Number(form.months),
    installmentsPaid: Number(form.installmentsPaid || '0'),
  };
  if (form.purchaseTransactionId) {
    input.purchaseTransactionId = form.purchaseTransactionId;
  }
  if (form.schedule) {
    input.installmentSchedule = form.schedule.map((r) => ({
      dueDate: r.day,
      amount: parseAmount(r.amount),
    }));
  }
  if (!form.withInterest) {
    input.interestMode = 'total_amount';
    input.totalToRepay = principal;
    return input;
  }
  input.interestMode = form.interestMode;
  if (form.interestMode === 'rate') {
    input.interestRateAnnual = parseRate(form.rate);
    input.includesVat = form.includesVat;
  } else if (form.interestMode === 'total_amount') {
    input.totalToRepay = parseAmount(form.totalToRepay);
  } else {
    input.installmentAmount = parseAmount(form.installmentAmount);
  }
  return input;
}
