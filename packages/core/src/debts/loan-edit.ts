import { dayKeyOf, isDayKey, type DayKey } from '../finance/dates';
import { parseAmount } from '../new-entry/form';
import { MAX_AMOUNT, NAME_MAX } from './form';
import { MAX_INSTALLMENTS } from './loan-form';
import { isLoanContainer, type ApiDebt, type LendingMethod } from './types';

/**
 * The loan's details tab in edit mode: what can change after it was
 * registered. A new amount, number of payments or fee makes the API
 * recompute the terms and the open payments.
 */
export interface LoanEditForm {
  name: string;
  /** Purchases and personal loans: what the first amount was. */
  description: string;
  lenderName: string;
  /** Personal loans: the contact who lent it ('' = none). */
  lenderContactId: string;
  /** Personal loans: how it was lent ('' = not said). */
  lendingMethod: LendingMethod | '';
  principal: string;
  /** Fixed-term loans only. */
  installments: string;
  /** '' = unknown. */
  startDate: string;
  /** Bank or lender loans only; VAT included. */
  openingFee: string;
  /** Bank or lender loans given by their rate; VAT included. */
  periodicFee: string;
  /** '' = not said. */
  purposeCategoryId: string;
  /**
   * Its money still counts in the account it was deposited to. Turning it
   * off removes that deposit (the money was spent); it can't be turned on.
   */
  depositAddsToBalance: boolean;
}

export type LoanEditField = keyof LoanEditForm;

export type LoanEditErrorCode =
  | 'nameRequired'
  | 'nameTooLong'
  | 'principalRequired'
  | 'principalInvalid'
  | 'installmentsRequired'
  | 'installmentsInvalid'
  | 'installmentsBelowPaid'
  | 'dateInFuture'
  | 'openingFeeInvalid'
  | 'periodicFeeInvalid';

export type LoanEditErrors = Partial<Record<LoanEditField, LoanEditErrorCode>>;

/** Which fields this loan shows. */
export interface LoanEditFields {
  /**
   * Its first amount and what defines it (amount, description, date, how it
   * was lent, purpose, deposit). False for purchase financing and personal
   * loans: those belong to each purchase or amount, edited apart.
   */
  terms: boolean;
  installments: boolean;
  openingFee: boolean;
  periodicFee: boolean;
}

type EditableDebt = Pick<
  ApiDebt,
  | 'name'
  | 'description'
  | 'lenderName'
  | 'lenderContactId'
  | 'lendingMethod'
  | 'principal'
  | 'installmentsTotal'
  | 'installmentsPaid'
  | 'startDate'
  | 'openingFee'
  | 'periodicFee'
  | 'purposeCategoryId'
  | 'loanType'
  | 'interestMode'
  | 'destination'
  | 'depositAddsToBalance'
>;

export function loanEditFields(debt: EditableDebt): LoanEditFields {
  const institutional = debt.loanType === 'institutional';
  const terms = !isLoanContainer(debt);
  return {
    terms,
    // A card purchase changes its installments one by one.
    installments:
      terms &&
      debt.interestMode !== null &&
      debt.loanType !== 'card_installments',
    openingFee: institutional,
    periodicFee: institutional && debt.interestMode === 'rate',
  };
}

const amountText = (n: number | null) => (n ? String(n) : '');

export function loanEditFormOf(debt: EditableDebt): LoanEditForm {
  return {
    name: debt.name,
    description: debt.description ?? '',
    lenderName: debt.lenderName ?? '',
    lenderContactId: debt.lenderContactId ?? '',
    lendingMethod: debt.lendingMethod ?? '',
    principal: String(debt.principal),
    installments: debt.installmentsTotal ? String(debt.installmentsTotal) : '',
    startDate: debt.startDate ? dayKeyOf(debt.startDate) : '',
    openingFee: amountText(debt.openingFee),
    periodicFee: amountText(debt.periodicFee),
    purposeCategoryId: debt.purposeCategoryId ?? '',
    depositAddsToBalance:
      debt.destination === 'deposit' && debt.depositAddsToBalance,
  };
}

const parseCount = (text: string): number | null =>
  /^\d+$/.test(text.trim()) ? Number(text.trim()) : null;

/** An empty fee is 0; null when it isn't a valid amount. */
const feeOf = (text: string): number | null =>
  text.trim() ? parseAmount(text) : 0;

export function validateLoanEdit(
  form: LoanEditForm,
  debt: EditableDebt,
  { today }: { today: DayKey },
): LoanEditErrors {
  const errors: LoanEditErrors = {};
  const fields = loanEditFields(debt);
  const name = form.name.trim();
  if (!name) errors.name = 'nameRequired';
  else if (name.length > NAME_MAX) errors.name = 'nameTooLong';

  const principal = parseAmount(form.principal);
  if (fields.terms) {
    if (!form.principal.trim()) errors.principal = 'principalRequired';
    else if (
      principal === null ||
      principal <= 0 ||
      principal > MAX_AMOUNT
    )
      errors.principal = 'principalInvalid';
  }

  if (fields.installments) {
    const count = parseCount(form.installments);
    if (!form.installments.trim()) errors.installments = 'installmentsRequired';
    else if (count === null || count < 1 || count > MAX_INSTALLMENTS)
      errors.installments = 'installmentsInvalid';
    else if (count < debt.installmentsPaid)
      errors.installments = 'installmentsBelowPaid';
  }

  if (fields.terms && isDayKey(form.startDate) && form.startDate > today)
    errors.startDate = 'dateInFuture';

  if (fields.openingFee) {
    const fee = feeOf(form.openingFee);
    if (fee === null || (principal !== null && fee >= principal))
      errors.openingFee = 'openingFeeInvalid';
  }
  if (fields.periodicFee && feeOf(form.periodicFee) === null)
    errors.periodicFee = 'periodicFeeInvalid';
  return errors;
}

/** UpdateLoanInput with only what changed; null when nothing did. */
export function buildLoanUpdate(
  form: LoanEditForm,
  debt: EditableDebt,
): Record<string, unknown> | null {
  const initial = loanEditFormOf(debt);
  const fields = loanEditFields(debt);
  const input: Record<string, unknown> = {};
  if (form.name.trim() !== initial.name) input.name = form.name.trim();
  if (debt.loanType === 'personal') {
    if (form.lenderContactId !== initial.lenderContactId)
      input.lenderContactId = form.lenderContactId || null;
  } else if (form.lenderName.trim() !== initial.lenderName)
    input.lenderName = form.lenderName.trim() || null;
  // Purchase financing and personal loans: only the loan's own data.
  if (!fields.terms) return Object.keys(input).length > 0 ? input : null;
  if (form.description.trim() !== initial.description)
    input.description = form.description.trim() || null;
  if (
    debt.loanType === 'personal' &&
    form.lendingMethod !== initial.lendingMethod
  )
    input.lendingMethod = form.lendingMethod || null;
  const principal = parseAmount(form.principal);
  if (principal !== null && principal !== debt.principal)
    input.principal = principal;
  if (fields.installments && form.installments !== initial.installments)
    input.installmentsTotal = parseCount(form.installments);
  if (form.startDate !== initial.startDate)
    input.startDate = isDayKey(form.startDate) ? form.startDate : null;
  if (fields.openingFee && feeOf(form.openingFee) !== (debt.openingFee ?? 0))
    input.openingFee = feeOf(form.openingFee);
  if (fields.periodicFee && feeOf(form.periodicFee) !== (debt.periodicFee ?? 0))
    input.periodicFee = feeOf(form.periodicFee);
  if (form.purposeCategoryId !== initial.purposeCategoryId)
    input.purposeCategoryId = form.purposeCategoryId || null;
  if (initial.depositAddsToBalance && !form.depositAddsToBalance)
    input.depositAddsToBalance = false;
  return Object.keys(input).length > 0 ? input : null;
}
