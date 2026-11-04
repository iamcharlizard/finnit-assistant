import {
  dayKeyOf,
  daysBetween,
  isDayKey,
  type DayKey,
} from '@/lib/finance/dates';
import { parseAmount } from '@/lib/new-entry/form';
import { MAX_AMOUNT, parseRate } from './form';
import { MAX_ANNUAL_RATE, MAX_INSTALLMENTS } from './loan-form';
import { previewLoanTerms, type LoanTermsPreview } from './loan-terms';
import type {
  ApiDebt,
  ApiDebtCharge,
  DebtDestination,
  LendingMethod,
  LoanFrequency,
} from './types';

/**
 * Money added to a loan: another personal loan, or a purchase financed with
 * Kueski / Didi (its own interest and number of payments, on the loan's
 * existing due dates).
 */
export interface ChargeForm {
  date: string;
  description: string;
  principal: string;
  /** '' = no fixed number of payments (personal loans). */
  installments: string;
  /** Of those, how many were paid before registering it ('' = none). */
  installmentsPaid: string;
  /** total: the total to repay ('' = no interest); rate: annual rate. */
  interest: 'total' | 'rate';
  totalToRepay: string;
  rate: string;
  includesVat: boolean;
  destination: DebtDestination;
  depositAccountId: string;
  depositCountsAsIncome: boolean;
  /**
   * Deposited money: add it to the account's balance. Off for money already
   * spent (e.g. registered months later): only the debt is recorded.
   */
  depositAddsToBalance: boolean;
  /** What this money was for (informative); '' = not said. */
  purposeCategoryId: string;
  /** Personal loans: how it was lent ('' = not said). */
  lendingMethod: LendingMethod | '';
  /**
   * Personal loans paid in installments without a schedule yet: first due
   * date ('' = a month after the date).
   */
  firstPaymentDate: string;
}

export type ChargeField = keyof ChargeForm;

export type ChargeErrorCode =
  | 'dateRequired'
  | 'dateInFuture'
  | 'principalRequired'
  | 'principalInvalid'
  | 'installmentsRequired'
  | 'installmentsInvalid'
  | 'installmentsPaidInvalid'
  | 'totalInvalid'
  | 'totalBelowPrincipal'
  | 'rateRequired'
  | 'rateInvalid'
  | 'firstPaymentBeforeDate'
  | 'depositAccountRequired';

export type ChargeFormErrors = Partial<Record<ChargeField, ChargeErrorCode>>;

export function newChargeForm(
  debt: Pick<ApiDebt, 'loanType'>,
  today: DayKey,
): ChargeForm {
  const purchase = debt.loanType === 'purchase_financing';
  return {
    date: today,
    description: '',
    principal: '',
    installments: '',
    installmentsPaid: '',
    interest: 'total',
    totalToRepay: '',
    rate: '',
    includesVat: false,
    destination: purchase ? 'purchase' : 'deposit',
    depositAccountId: '',
    depositCountsAsIncome: false,
    depositAddsToBalance: true,
    purposeCategoryId: '',
    lendingMethod: '',
    firstPaymentDate: '',
  };
}

/** The form of a charge being edited, with its terms as they were given. */
export function chargeFormOf(charge: ApiDebtCharge): ChargeForm {
  const byRate = charge.interestMode === 'rate';
  return {
    date: dayKeyOf(charge.date),
    description: charge.description ?? '',
    principal: String(charge.principal),
    installments: charge.installments ? String(charge.installments) : '',
    installmentsPaid: charge.installmentsPaid
      ? String(charge.installmentsPaid)
      : '',
    interest: byRate ? 'rate' : 'total',
    totalToRepay:
      !byRate && charge.totalToRepay !== charge.principal
        ? String(charge.totalToRepay)
        : '',
    rate:
      byRate && charge.interestRateAnnual !== null
        ? String(charge.interestRateAnnual)
        : '',
    includesVat: byRate && charge.includesVat,
    destination: charge.destination,
    depositAccountId: charge.depositAccountId ?? '',
    depositCountsAsIncome: charge.depositCountsAsIncome ?? false,
    depositAddsToBalance: charge.depositAddsToBalance,
    purposeCategoryId: charge.purposeCategoryId ?? '',
    lendingMethod: charge.lendingMethod ?? '',
    firstPaymentDate: charge.firstPaymentDate
      ? dayKeyOf(charge.firstPaymentDate)
      : '',
  };
}

/**
 * Loans whose payments come from each amount's own installments (purchase
 * financing, personal loans without a fixed payment) take how many of them
 * were already paid.
 */
export function asksPaidInstallments(
  debt: Pick<ApiDebt, 'loanType' | 'installmentAmount'>,
  form: Pick<ChargeForm, 'installments'>,
): boolean {
  const byCharges =
    debt.loanType === 'purchase_financing' ||
    (debt.loanType === 'personal' && debt.installmentAmount === null);
  return byCharges && Boolean(form.installments.trim());
}

/**
 * Amounts paid in their own installments (purchase financing, personal
 * loans without a fixed payment) may start later than the loan's next due
 * date (e.g. the quincena after): the form asks when the first one is due.
 */
export function asksFirstPayment(
  debt: Pick<ApiDebt, 'loanType' | 'installmentAmount'>,
  form: Pick<ChargeForm, 'installments'>,
): boolean {
  return asksPaidInstallments(debt, form);
}

const parseCount = (text: string): number | null =>
  /^\d+$/.test(text.trim()) ? Number(text.trim()) : null;

/** Payments of a financed purchase, or null while something is missing. */
export function chargePreview(
  form: ChargeForm,
  frequency: LoanFrequency,
): LoanTermsPreview | null {
  const principal = parseAmount(form.principal);
  const installments = parseCount(form.installments);
  if (principal === null || installments === null) return null;
  return previewLoanTerms({
    mode: form.interest === 'rate' ? 'rate' : 'total_amount',
    principal,
    installments,
    frequency,
    annualRate: parseRate(form.rate),
    includesVat: form.includesVat,
    totalToRepay: form.totalToRepay.trim()
      ? parseAmount(form.totalToRepay)
      : principal,
  });
}

export function validateChargeForm(
  form: ChargeForm,
  { today, needsInstallments }: { today: DayKey; needsInstallments: boolean },
): ChargeFormErrors {
  const errors: ChargeFormErrors = {};
  if (!isDayKey(form.date)) errors.date = 'dateRequired';
  else if (form.date > today) errors.date = 'dateInFuture';

  const principal = parseAmount(form.principal);
  if (!form.principal.trim()) errors.principal = 'principalRequired';
  else if (principal === null || principal <= 0 || principal > MAX_AMOUNT)
    errors.principal = 'principalInvalid';

  if (!form.installments.trim()) {
    if (needsInstallments) errors.installments = 'installmentsRequired';
  } else {
    const n = parseCount(form.installments);
    if (n === null || n < 1 || n > MAX_INSTALLMENTS)
      errors.installments = 'installmentsInvalid';
    else if (form.installmentsPaid.trim()) {
      const paid = parseCount(form.installmentsPaid);
      if (paid === null || paid > n)
        errors.installmentsPaid = 'installmentsPaidInvalid';
    }
  }

  if (form.interest === 'rate' && form.installments.trim()) {
    const rate = parseRate(form.rate);
    if (!form.rate.trim()) errors.rate = 'rateRequired';
    else if (rate === null || rate > MAX_ANNUAL_RATE)
      errors.rate = 'rateInvalid';
  } else if (form.totalToRepay.trim()) {
    const total = parseAmount(form.totalToRepay);
    if (total === null || total <= 0 || total > MAX_AMOUNT)
      errors.totalToRepay = 'totalInvalid';
    else if (principal !== null && total < principal)
      errors.totalToRepay = 'totalBelowPrincipal';
  }

  if (
    form.installments.trim() &&
    isDayKey(form.firstPaymentDate) &&
    isDayKey(form.date) &&
    form.firstPaymentDate < form.date
  )
    errors.firstPaymentDate = 'firstPaymentBeforeDate';

  if (
    form.destination === 'deposit' &&
    form.depositAddsToBalance &&
    !form.depositAccountId
  )
    errors.depositAccountId = 'depositAccountRequired';
  return errors;
}

/** AddDebtChargeInput (or UpdateDebtChargeInput without `debtId`) of a valid form. */
export function buildChargeInput(
  form: ChargeForm,
  debtId?: string,
): Record<string, unknown> {
  const installments = parseCount(form.installments);
  const useRate = form.interest === 'rate' && installments !== null;
  return {
    ...(debtId && { debtId }),
    date: form.date,
    principal: parseAmount(form.principal),
    destination: form.destination,
    ...(form.description.trim() && { description: form.description.trim() }),
    ...(form.purposeCategoryId && {
      purposeCategoryId: form.purposeCategoryId,
    }),
    ...(form.lendingMethod && { lendingMethod: form.lendingMethod }),
    ...(installments !== null && { installments }),
    ...(installments !== null &&
      parseCount(form.installmentsPaid) !== null && {
        installmentsPaid: parseCount(form.installmentsPaid),
      }),
    ...(installments !== null &&
      isDayKey(form.firstPaymentDate) && {
        firstPaymentDate: form.firstPaymentDate,
      }),
    ...(useRate
      ? {
          interestMode: 'rate',
          interestRateAnnual: parseRate(form.rate),
          includesVat: form.includesVat,
        }
      : form.totalToRepay.trim()
        ? { totalToRepay: parseAmount(form.totalToRepay) }
        : {}),
    ...(form.destination === 'deposit' &&
      (form.depositAddsToBalance
        ? {
            depositAccountId: form.depositAccountId,
            depositCountsAsIncome: form.depositCountsAsIncome,
          }
        : { depositAddsToBalance: false })),
  };
}

/** Borrowed money older than this is assumed spent by default. */
export const RECENT_DEPOSIT_DAYS = 31;

/**
 * Whether money borrowed on `date` starts added to the account's balance:
 * yes when recent (or the date is unknown), no when it is older than
 * RECENT_DEPOSIT_DAYS, since it was most likely spent already.
 */
export function addsToBalanceByDefault(date: string, today: DayKey): boolean {
  return !isDayKey(date) || daysBetween(date, today) <= RECENT_DEPOSIT_DAYS;
}
