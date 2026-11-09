import { dayKeyOf, isDayKey, type DayKey } from '../finance/dates';
import { roundCents } from '../finance/money';
import { parseAmount } from '../new-entry/form';
import type { BudgetCategory } from '../budgets/types';
import { MAX_AMOUNT, NAME_MAX, parseRate } from './form';
import {
  INTEREST_VAT_RATE,
  previewLoanTerms,
  type LoanTermsPreview,
} from './loan-terms';
import {
  LOAN_FREQUENCIES,
  type ApiLoanDraft,
  type DebtDestination,
  type LendingMethod,
  type LoanFrequency,
  type LoanInterestMode,
  type LoanFormType as LoanType,
} from './types';

/**
 * The loan dialog (new loan, or a recurring suggestion turned into one):
 * fields as typed, validation, the terms preview and the API input.
 *
 * - institutional / purchase_financing: fixed number of payments on a
 *   schedule; terms from the rate, the total or the payment amount.
 * - personal: optional total (when there is interest) and an optional
 *   agreed payment that schedules it; past payments are listed one by one.
 */
export const MAX_ANNUAL_RATE = 1000;
export const MAX_INSTALLMENTS = 1000;

/** A payment made before registering the loan. */
export interface HistoricalRow {
  key: string;
  amount: string;
  /** 'YYYY-MM-DD'. */
  date: string;
  /** '' = outside totals; an account = an expense from it (counts). */
  accountId: string;
}

export interface LoanForm {
  loanType: LoanType;
  name: string;
  /** Purchases and personal loans: what the first amount was ('' = not said). */
  description: string;
  lenderName: string;
  /** Personal loans: the contact picked ('' = none; a typed name becomes one). */
  lenderContactId: string;
  /** Personal loans: how it was lent ('' = not said). */
  lendingMethod: LendingMethod | '';
  /** Borrowed amount (purchase financing: the first purchase). */
  principal: string;
  /** Loan or purchase date; '' = unknown. */
  startDate: string;
  /** Personal loans only: there is an agreed periodic payment. */
  hasSchedule: boolean;
  frequency: LoanFrequency;
  installments: string;
  interestMode: LoanInterestMode;
  rate: string;
  includesVat: boolean;
  /** Bank or lender loans: comisión por apertura, VAT included. */
  openingFee: string;
  /** Bank or lender loans with a rate: fixed fee with every payment. */
  periodicFee: string;
  /** The fee was typed without VAT: add 16%. */
  periodicFeeAddVat: boolean;
  /** The deposited amount is typed instead of computed. */
  editDeposit: boolean;
  /** What reached the account; only read when `editDeposit`. */
  depositAmount: string;
  totalToRepay: string;
  installmentAmount: string;
  firstPaymentDate: string;
  /** Scheduled payments already made (fixed-term loans). */
  installmentsPaid: string;
  historical: HistoricalRow[];
  destination: DebtDestination;
  depositAccountId: string;
  depositCountsAsIncome: boolean;
  /**
   * Add the borrowed money to the account's balance. Off for money already
   * spent (an old loan): only the debt is recorded.
   */
  depositAddsToBalance: boolean;
  paymentAccountId: string;
  categoryId: string;
  /** What the money was for (informative); '' = not said. */
  purposeCategoryId: string;
}

export type LoanField = keyof LoanForm;

export type LoanErrorCode =
  | 'nameRequired'
  | 'nameTooLong'
  | 'principalRequired'
  | 'principalInvalid'
  | 'installmentsRequired'
  | 'installmentsInvalid'
  | 'rateRequired'
  | 'rateInvalid'
  | 'totalRequired'
  | 'totalInvalid'
  | 'totalBelowPrincipal'
  | 'installmentAmountRequired'
  | 'installmentAmountInvalid'
  | 'openingFeeInvalid'
  | 'periodicFeeInvalid'
  | 'depositMismatch'
  | 'firstPaymentRequired'
  | 'purchaseAfterFirstPayment'
  | 'paidInvalid'
  | 'paidTooMany'
  | 'paidBelowDetected'
  | 'depositAccountRequired'
  | 'historicalInvalid'
  | 'historicalTooMuch';

export type LoanFormErrors = Partial<Record<LoanField, LoanErrorCode>>;

/** Fixed number of payments on a schedule. */
export function isFixedTerm(type: LoanType): boolean {
  return type !== 'personal';
}

export function newLoanForm(loanType: LoanType = 'institutional'): LoanForm {
  return {
    loanType,
    name: '',
    description: '',
    lenderName: '',
    lenderContactId: '',
    lendingMethod: '',
    principal: '',
    startDate: '',
    hasSchedule: false,
    frequency: loanType === 'purchase_financing' ? 'semimonthly' : 'monthly',
    installments: '',
    interestMode: loanType === 'purchase_financing' ? 'total_amount' : 'rate',
    rate: '',
    includesVat: loanType === 'institutional',
    openingFee: '',
    periodicFee: '',
    periodicFeeAddVat: false,
    editDeposit: false,
    depositAmount: '',
    totalToRepay: '',
    installmentAmount: '',
    firstPaymentDate: '',
    installmentsPaid: '',
    historical: [],
    destination: loanType === 'purchase_financing' ? 'purchase' : 'deposit',
    depositAccountId: '',
    depositCountsAsIncome: false,
    depositAddsToBalance: true,
    paymentAccountId: '',
    categoryId: '',
    purposeCategoryId: '',
  };
}

/** Default categories of loan payments (API: default-categories.ts). */
export const PAYMENT_CATEGORY_KEYS = {
  loan: 'categories.debts.loan_payments',
  installment: 'categories.debts.installment_payments',
} as const;

/**
 * The user's default category for this loan's payments: Installment
 * Payments for purchase financing, Loan Payments otherwise ('' if they
 * deleted it).
 */
export function defaultPaymentCategoryId(
  categories: ReadonlyArray<Pick<BudgetCategory, 'id' | 'key'>>,
  loanType: LoanType,
): string {
  const key =
    loanType === 'purchase_financing'
      ? PAYMENT_CATEGORY_KEYS.installment
      : PAYMENT_CATEGORY_KEYS.loan;
  return categories.find((category) => category.key === key)?.id ?? '';
}

/**
 * Fills the payment category with the default one, or swaps it when the
 * type changed and it still had the previous type's default.
 */
export function withDefaultPaymentCategory(
  form: LoanForm,
  categories: ReadonlyArray<Pick<BudgetCategory, 'id' | 'key'>>,
  previousType?: LoanType,
): LoanForm {
  const keep =
    form.categoryId &&
    (previousType === undefined ||
      form.categoryId !== defaultPaymentCategoryId(categories, previousType));
  if (keep) return form;
  return {
    ...form,
    categoryId:
      defaultPaymentCategoryId(categories, form.loanType) || form.categoryId,
  };
}

/** Switching the type keeps what was typed and resets type defaults. */
export function withLoanType(form: LoanForm, loanType: LoanType): LoanForm {
  const defaults = newLoanForm(loanType);
  return {
    ...form,
    loanType,
    frequency: defaults.frequency,
    interestMode: defaults.interestMode,
    includesVat: defaults.includesVat,
    destination: defaults.destination,
  };
}

const amountText = (amount: number) =>
  Number.isInteger(amount) ? String(amount) : amount.toFixed(2);

/** The dialog prefilled from a suggestion's loan draft. */
export function formOfDraft(draft: ApiLoanDraft): LoanForm {
  const base = newLoanForm(draft.loanType);
  const frequency = (LOAN_FREQUENCIES as ReadonlyArray<string>).includes(
    draft.paymentFrequency,
  )
    ? (draft.paymentFrequency as LoanFrequency)
    : base.frequency;
  return {
    ...base,
    name: draft.name,
    lenderName: draft.lenderName,
    frequency,
    hasSchedule: true,
    // The detected charge is the payment; principal and count are the user's.
    interestMode: 'installment_amount',
    installmentAmount: amountText(draft.installmentAmount),
    firstPaymentDate: dayKeyOf(draft.firstPaymentDate),
    installmentsPaid: String(draft.paymentsDetected),
    paymentAccountId: draft.paymentAccountId ?? '',
    categoryId: draft.categoryId ?? '',
  };
}

const parseCount = (text: string): number | null =>
  /^\d+$/.test(text.trim()) ? Number(text.trim()) : null;

/** Fee per payment with VAT (0 when empty or not a bank loan by its rate). */
export function periodicFeeOf(form: LoanForm): number {
  if (
    form.loanType !== 'institutional' ||
    form.interestMode !== 'rate' ||
    !form.periodicFee.trim()
  )
    return 0;
  const fee = parseAmount(form.periodicFee) ?? 0;
  return roundCents(
    form.periodicFeeAddVat ? fee * (1 + INTEREST_VAT_RATE) : fee,
  );
}

/** Opening fee typed (0 when empty or not a bank or lender loan). */
export function openingFeeOf(form: LoanForm): number {
  if (form.loanType !== 'institutional' || !form.openingFee.trim()) return 0;
  return parseAmount(form.openingFee) ?? 0;
}

/** What reaches the account: the amount borrowed minus the opening fee. */
export function expectedDeposit(form: LoanForm): number | null {
  const principal = parseAmount(form.principal);
  if (principal === null) return null;
  return roundCents(principal - openingFeeOf(form));
}

/**
 * The typed deposit doesn't match borrowed − fee (saving is blocked until
 * it does). Null when there is nothing to compare.
 */
export function depositMismatch(
  form: LoanForm,
): { expected: number; typed: number } | null {
  if (
    form.loanType !== 'institutional' ||
    form.destination !== 'deposit' ||
    !form.depositAddsToBalance ||
    !form.editDeposit
  )
    return null;
  const expected = expectedDeposit(form);
  const typed = parseAmount(form.depositAmount);
  if (expected === null || typed === null) return null;
  return Math.abs(typed - expected) > 0.005 ? { expected, typed } : null;
}

/** What the terms come to, or null while something is missing. */
export function loanPreview(form: LoanForm): LoanTermsPreview | null {
  const principal = parseAmount(form.principal);
  const installments = parseCount(form.installments);
  if (principal === null) return null;
  if (!isFixedTerm(form.loanType)) {
    const total = form.totalToRepay.trim()
      ? parseAmount(form.totalToRepay)
      : principal;
    if (total === null) return null;
    const payment = form.hasSchedule
      ? parseAmount(form.installmentAmount)
      : null;
    return {
      installmentAmount: payment ?? 0,
      totalToRepay: roundCents(total),
      interest: roundCents(total - principal),
    };
  }
  if (installments === null) return null;
  return previewLoanTerms({
    mode: form.interestMode,
    principal,
    installments,
    frequency: form.frequency,
    annualRate: form.rate.trim() ? parseRate(form.rate) : null,
    includesVat: form.includesVat,
    totalToRepay: parseAmount(form.totalToRepay),
    installmentAmount: parseAmount(form.installmentAmount),
    periodicFee: periodicFeeOf(form),
  });
}

/**
 * A personal loan with no first amount (empty or 0): each amount is added
 * later from its page, so there is no deposit or "how it was lent" yet.
 */
export function startsEmpty(form: LoanForm): boolean {
  return form.loanType === 'personal' && !(parseAmount(form.principal) ?? 0);
}

function validAmount(text: string): boolean {
  const amount = parseAmount(text);
  return amount !== null && amount > 0 && amount <= MAX_AMOUNT;
}

export function validateLoanForm(
  form: LoanForm,
  { today, detectedPayments = 0 }: { today: DayKey; detectedPayments?: number },
): LoanFormErrors {
  const errors: LoanFormErrors = {};
  const name = form.name.trim();
  if (!name) errors.name = 'nameRequired';
  else if (name.length > NAME_MAX) errors.name = 'nameTooLong';

  if (form.loanType === 'personal') {
    // May start at 0: its amounts are added later.
    const amount = form.principal.trim() ? parseAmount(form.principal) : 0;
    if (amount === null || amount < 0 || amount > MAX_AMOUNT)
      errors.principal = 'principalInvalid';
  } else if (!form.principal.trim()) errors.principal = 'principalRequired';
  else if (!validAmount(form.principal)) errors.principal = 'principalInvalid';
  const principal = parseAmount(form.principal) ?? 0;

  const fixed = isFixedTerm(form.loanType);
  const scheduled = fixed || form.hasSchedule;

  if (form.loanType === 'institutional' && form.openingFee.trim()) {
    const fee = parseAmount(form.openingFee);
    if (fee === null || fee < 0 || (principal > 0 && fee >= principal))
      errors.openingFee = 'openingFeeInvalid';
  }
  if (
    form.loanType === 'institutional' &&
    form.interestMode === 'rate' &&
    form.periodicFee.trim() &&
    parseAmount(form.periodicFee) === null
  )
    errors.periodicFee = 'periodicFeeInvalid';
  if (!errors.openingFee && depositMismatch(form))
    errors.openingFee = 'depositMismatch';

  if (fixed) {
    const installments = parseCount(form.installments);
    if (!form.installments.trim()) errors.installments = 'installmentsRequired';
    else if (
      installments === null ||
      installments < 1 ||
      installments > MAX_INSTALLMENTS
    )
      errors.installments = 'installmentsInvalid';

    if (form.interestMode === 'rate') {
      const rate = parseRate(form.rate);
      if (!form.rate.trim()) errors.rate = 'rateRequired';
      else if (rate === null || rate > MAX_ANNUAL_RATE)
        errors.rate = 'rateInvalid';
    }
    if (form.interestMode === 'total_amount') {
      if (!form.totalToRepay.trim()) errors.totalToRepay = 'totalRequired';
      else if (!validAmount(form.totalToRepay))
        errors.totalToRepay = 'totalInvalid';
      else if ((parseAmount(form.totalToRepay) ?? 0) < principal)
        errors.totalToRepay = 'totalBelowPrincipal';
    }
    if (form.interestMode === 'installment_amount') {
      if (!form.installmentAmount.trim())
        errors.installmentAmount = 'installmentAmountRequired';
      else if (!validAmount(form.installmentAmount))
        errors.installmentAmount = 'installmentAmountInvalid';
    }
    if (
      form.interestMode === 'installment_amount' &&
      !errors.installments &&
      !errors.installmentAmount
    ) {
      const preview = loanPreview(form);
      if (preview && preview.totalToRepay < principal)
        errors.installmentAmount = 'installmentAmountInvalid';
    }

    const paid = form.installmentsPaid.trim()
      ? parseCount(form.installmentsPaid)
      : 0;
    if (paid === null) errors.installmentsPaid = 'paidInvalid';
    else if (installments !== null && paid > installments)
      errors.installmentsPaid = 'paidTooMany';
    else if (paid < detectedPayments)
      errors.installmentsPaid = 'paidBelowDetected';
  } else {
    if (form.totalToRepay.trim()) {
      if (!validAmount(form.totalToRepay)) errors.totalToRepay = 'totalInvalid';
      else if ((parseAmount(form.totalToRepay) ?? 0) < principal)
        errors.totalToRepay = 'totalBelowPrincipal';
    }
    if (form.hasSchedule) {
      if (!form.installmentAmount.trim())
        errors.installmentAmount = 'installmentAmountRequired';
      else if (!validAmount(form.installmentAmount))
        errors.installmentAmount = 'installmentAmountInvalid';
    }
    const owed = parseAmount(form.totalToRepay) ?? principal;
    const rows = form.historical;
    if (
      rows.some(
        (row) =>
          !validAmount(row.amount) || !isDayKey(row.date) || row.date > today,
      )
    )
      errors.historical = 'historicalInvalid';
    else if (
      rows.reduce((sum, row) => sum + (parseAmount(row.amount) ?? 0), 0) >
      owed + 0.001
    )
      errors.historical = 'historicalTooMuch';
  }

  if (scheduled && !isDayKey(form.firstPaymentDate))
    errors.firstPaymentDate = 'firstPaymentRequired';
  if (
    form.loanType === 'purchase_financing' &&
    isDayKey(form.startDate) &&
    isDayKey(form.firstPaymentDate) &&
    form.startDate >= form.firstPaymentDate
  )
    errors.startDate = 'purchaseAfterFirstPayment';

  if (
    form.destination === 'deposit' &&
    form.depositAddsToBalance &&
    !startsEmpty(form) &&
    !form.depositAccountId
  )
    errors.depositAccountId = 'depositAccountRequired';
  return errors;
}

type Input = Record<string, unknown>;

/** Longest description of a loan's first amount (as a charge's). */
export const DESCRIPTION_MAX = 200;

/**
 * Purchase financing and personal loans name their first amount, the label
 * of its installments (bank loans are one amount: the name says it).
 */
export const hasDescription = (
  loanType: string | null,
): loanType is 'purchase_financing' | 'personal' =>
  loanType === 'purchase_financing' || loanType === 'personal';

/** CreateDebtInput (and AcceptSuggestionAsLoanInput) of a valid form. */
export function buildLoanInput(form: LoanForm): Input {
  const fixed = isFixedTerm(form.loanType);
  const scheduled = fixed || form.hasSchedule;
  const input: Input = {
    name: form.name.trim(),
    ...(hasDescription(form.loanType) &&
      form.description.trim() && { description: form.description.trim() }),
    kind: 'loan',
    loanType: form.loanType,
    principal: parseAmount(form.principal) ?? 0,
    destination: form.destination,
  };
  const set = (key: string, value: unknown) => {
    if (value !== null && value !== undefined && value !== '')
      input[key] = value;
  };
  if (form.loanType === 'personal' && form.lenderContactId)
    input.lenderContactId = form.lenderContactId;
  else set('lenderName', form.lenderName.trim());
  if (form.loanType === 'personal' && !startsEmpty(form))
    set('lendingMethod', form.lendingMethod);
  set('startDate', isDayKey(form.startDate) ? form.startDate : null);
  set('paymentAccountId', form.paymentAccountId);
  set('categoryId', form.categoryId);
  set('purposeCategoryId', form.purposeCategoryId);
  if (startsEmpty(form)) delete input.destination;
  else if (form.destination === 'deposit' && !form.depositAddsToBalance)
    input.depositAddsToBalance = false;
  else if (form.destination === 'deposit') {
    input.depositAccountId = form.depositAccountId;
    input.depositCountsAsIncome = form.depositCountsAsIncome;
  }

  const fee = openingFeeOf(form);
  if (fee > 0) input.openingFee = fee;
  const periodicFee = periodicFeeOf(form);
  if (periodicFee > 0) input.periodicFee = periodicFee;

  if (fixed) {
    input.installmentsTotal = parseCount(form.installments);
    input.interestMode = form.interestMode;
    if (form.interestMode === 'rate') {
      input.interestRateAnnual = parseRate(form.rate);
      input.includesVat = form.includesVat;
    }
    if (form.interestMode === 'total_amount')
      input.totalToRepay = parseAmount(form.totalToRepay);
    if (form.interestMode === 'installment_amount')
      input.installmentAmount = parseAmount(form.installmentAmount);
    input.installmentsPaid = parseCount(form.installmentsPaid) ?? 0;
  } else {
    set(
      'totalToRepay',
      form.totalToRepay.trim() ? parseAmount(form.totalToRepay) : null,
    );
    if (form.hasSchedule)
      input.installmentAmount = parseAmount(form.installmentAmount);
    if (form.historical.length > 0) {
      input.historicalPayments = form.historical.map((row) => ({
        amount: parseAmount(row.amount),
        date: row.date,
        ...(row.accountId && { accountId: row.accountId }),
      }));
    }
  }
  if (scheduled) {
    input.paymentFrequency = form.frequency;
    input.firstPaymentDate = form.firstPaymentDate;
  }
  return input;
}

let rowSeq = 0;

export function newHistoricalRow(today: DayKey): HistoricalRow {
  rowSeq += 1;
  return { key: `row-${rowSeq}`, amount: '', date: today, accountId: '' };
}
