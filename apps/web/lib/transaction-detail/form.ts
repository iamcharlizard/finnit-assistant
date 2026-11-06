import { dayKeyOf, isDayKey, type DayKey } from '@/lib/finance/dates';
import { MAX_AMOUNT, parseAmount } from '@/lib/new-entry/form';
import type { TransactionDetail } from './types';
import type { EditRules } from './view';

/** The detail's edit form (text as typed; parsed on save). */
export interface DetailForm {
  amount: string;
  date: DayKey;
  categoryId: string;
  merchantName: string;
  /** What a movement made by hand was (its title when there's no merchant). */
  description: string;
  /** The user's notes, on any movement. */
  notes: string;
}

export const MERCHANT_MAX = 120;
export const DESCRIPTION_MAX = 500;
/** Same limit as the API (MAX_TRANSACTION_NOTES). */
export const NOTES_MAX = 1000;

export type DetailFormError =
  | 'amountRequired'
  | 'amountInvalid'
  | 'amountTooLarge'
  | 'dateRequired'
  | 'dateInFuture';

export type DetailFormErrors = Partial<
  Record<'amount' | 'date', DetailFormError>
>;

export function detailFormOf(tx: TransactionDetail): DetailForm {
  return {
    amount: tx.amount.toFixed(2),
    date: dayKeyOf(tx.txnDate),
    categoryId: tx.category?.id ?? '',
    merchantName: tx.merchantName ?? '',
    description: tx.description ?? '',
    notes: tx.notes ?? '',
  };
}

export function validateDetailForm(
  form: DetailForm,
  rules: EditRules,
  today: DayKey,
): DetailFormErrors {
  const errors: DetailFormErrors = {};
  if (rules.amount) {
    const value = parseAmount(form.amount);
    if (!form.amount.trim()) errors.amount = 'amountRequired';
    else if (value === null || value <= 0) errors.amount = 'amountInvalid';
    else if (value > MAX_AMOUNT) errors.amount = 'amountTooLarge';
  }
  if (rules.date) {
    if (!isDayKey(form.date)) errors.date = 'dateRequired';
    else if (form.date > today) errors.date = 'dateInFuture';
  }
  return errors;
}

export interface UpdateTransactionPayload {
  amount?: number;
  txnDate?: DayKey;
  categoryId?: string;
  merchantName?: string;
  description?: string;
  /** "" clears them. */
  notes?: string;
  /** false: the bank already applied it ("Marcar como aplicado"). */
  inProcess?: boolean;
}

/**
 * updateTransaction's input: only fields the rules allow and the user
 * changed (null when nothing changed). The API can't clear a category or
 * a text field: an emptied field is sent as "" (text; for notes it clears
 * them) or left out (category).
 */
export function buildUpdateInput(
  form: DetailForm,
  initial: DetailForm,
  rules: EditRules,
): UpdateTransactionPayload | null {
  const input: UpdateTransactionPayload = {};
  if (rules.amount) {
    const amount = parseAmount(form.amount);
    if (amount !== null && amount !== parseAmount(initial.amount)) {
      input.amount = amount;
    }
  }
  if (rules.date && form.date !== initial.date) input.txnDate = form.date;
  if (
    rules.category &&
    form.categoryId &&
    form.categoryId !== initial.categoryId
  ) {
    input.categoryId = form.categoryId;
  }
  if (rules.merchant && form.merchantName.trim() !== initial.merchantName) {
    input.merchantName = form.merchantName.trim();
  }
  if (rules.description && form.description.trim() !== initial.description) {
    input.description = form.description.trim();
  }
  if (rules.notes && form.notes.trim() !== initial.notes.trim()) {
    input.notes = form.notes.trim();
  }
  return Object.keys(input).length > 0 ? input : null;
}
