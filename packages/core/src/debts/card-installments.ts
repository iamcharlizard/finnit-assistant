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
  | 'installmentsPaidTooMany';

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
  };
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
  const next = {
    ...form,
    ...patch,
    ...('installmentsPaid' in patch ? { paidTouched: true } : {}),
  };
  if (next.paidTouched) return next;
  const months = wholeNumber(next.months);
  if (!months || !isDayKey(next.purchaseDate)) {
    return { ...next, installmentsPaid: '0' };
  }
  const terms = cardTermsOf(accounts.find((a) => a.id === next.accountId));
  const billed = billedInstallments(next.purchaseDate, months, terms, today);
  return { ...next, installmentsPaid: String(billed) };
}

/** The terms the API will store, or null while a value is missing. */
export function cardInstallmentPreview(
  form: CardInstallmentForm,
): LoanTermsPreview | null {
  const principal = parseAmount(form.principal) ?? 0;
  const months = wholeNumber(form.months) ?? 0;
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
  const months = wholeNumber(form.months);
  if (!months || months > MAX_MONTHS || !isDayKey(form.purchaseDate)) {
    return null;
  }
  const terms = cardTermsOf(accounts.find((a) => a.id === form.accountId));
  const days = installmentDays(form.purchaseDate, months, terms);
  return { first: days[0]!, last: days[days.length - 1]! };
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
