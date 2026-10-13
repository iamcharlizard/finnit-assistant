import {
  dayKeyOf,
  isDayKey,
  startOfDayIso,
  type DayKey,
} from '@/lib/finance/dates';
import { DEFAULT_CURRENCY } from '@/lib/finance/money';
import type { RecurringKind } from '@/lib/finance/types';
import { parseAmount } from '@/lib/new-entry/form';
import type {
  ApiRecurringExpense,
  ApiRecurringSuggestion,
  RecurringFrequency,
  RecurringTrackingMode,
} from './types';

/**
 * The "pago recurrente" dialog: its fields as typed, validation, and the
 * API inputs for create, edit and accepting a suggestion.
 */
export interface RecurringForm {
  name: string;
  kind: RecurringKind;
  trackingMode: RecurringTrackingMode;
  frequency: RecurringFrequency;
  interval: string;
  /** 'YYYY-MM-DD' or ''. */
  startDate: string;
  /** 'YYYY-MM-DD' or '' (no end). */
  endDate: string;
  amount: string;
  isVariableAmount: boolean;
  currency: string;
  /** '' = none. */
  accountId: string;
  categoryId: string;
  merchantPattern: string;
  installmentsTotal: string;
  installmentsPaid: string;
  notes: string;
}

export type FormField = keyof RecurringForm;

export type FormErrorCode =
  | 'nameRequired'
  | 'nameTooLong'
  | 'amountRequired'
  | 'amountInvalid'
  | 'amountTooLarge'
  | 'intervalInvalid'
  | 'startDateRequired'
  | 'endBeforeStart'
  | 'installmentsRequired'
  | 'installmentsInvalid'
  | 'installmentsPaidInvalid'
  | 'installmentsPaidTooMany'
  | 'patternTooLong'
  | 'notesTooLong';

export type FormErrors = Partial<Record<FormField, FormErrorCode>>;

export const NAME_MAX = 100;
export const PATTERN_MAX = 100;
export const NOTES_MAX = 500;
export const MAX_AMOUNT = 999_999_999;
export const MAX_INTERVAL = 12;

export function newRecurringForm({
  today,
  currency = DEFAULT_CURRENCY,
}: {
  today: DayKey;
  currency?: string;
}): RecurringForm {
  return {
    name: '',
    kind: 'subscription',
    trackingMode: 'manual',
    frequency: 'monthly',
    interval: '1',
    startDate: today,
    endDate: '',
    amount: '',
    isVariableAmount: false,
    currency,
    accountId: '',
    categoryId: '',
    merchantPattern: '',
    installmentsTotal: '',
    installmentsPaid: '0',
    notes: '',
  };
}

const amountText = (amount: number) =>
  Number.isInteger(amount) ? String(amount) : amount.toFixed(2);

export function formOfExpense(expense: ApiRecurringExpense): RecurringForm {
  return {
    name: expense.name,
    kind: expense.kind,
    trackingMode: expense.trackingMode,
    frequency: expense.frequency,
    interval: String(expense.interval),
    startDate: dayKeyOf(expense.startDate),
    endDate: expense.endDate ? dayKeyOf(expense.endDate) : '',
    amount: amountText(expense.amount),
    isVariableAmount: expense.isVariableAmount,
    currency: expense.currency,
    accountId: expense.accountId ?? '',
    categoryId: expense.categoryId ?? '',
    merchantPattern: expense.merchantPattern ?? '',
    installmentsTotal:
      expense.installmentsTotal != null
        ? String(expense.installmentsTotal)
        : '',
    installmentsPaid: String(expense.installmentsPaid),
    notes: expense.notes ?? '',
  };
}

/**
 * A suggestion as the dialog's starting point: everything detected,
 * charged by itself (it was found in the bank's movements) and matched by
 * the merchant's text. The first payment is the oldest movement found, as
 * the API does: those movements become the expense's paid history.
 */
export function formOfSuggestion(
  suggestion: ApiRecurringSuggestion,
): RecurringForm {
  return {
    name: suggestion.suggestedName,
    kind: suggestion.kind,
    trackingMode: 'automatic',
    frequency: suggestion.frequency,
    interval: String(suggestion.interval || 1),
    startDate: dayKeyOf(
      suggestion.occurrences
        .map((o) => o.date)
        .sort()
        .at(0) ?? suggestion.nextDueDate,
    ),
    endDate: '',
    amount: amountText(Math.round(suggestion.amount * 100) / 100),
    isVariableAmount: suggestion.isVariableAmount,
    currency: suggestion.currency,
    accountId: suggestion.account?.id ?? '',
    categoryId: suggestion.category?.id ?? '',
    merchantPattern: suggestion.merchant.trim().toUpperCase(),
    installmentsTotal: '',
    installmentsPaid: '0',
    notes: '',
  };
}

function wholeNumber(text: string): number | null {
  const value = text.trim();
  return /^\d+$/.test(value) ? Number(value) : null;
}

export function validateRecurringForm(form: RecurringForm): FormErrors {
  const errors: FormErrors = {};
  const name = form.name.trim();
  if (!name) errors.name = 'nameRequired';
  else if (name.length > NAME_MAX) errors.name = 'nameTooLong';

  if (!form.amount.trim()) errors.amount = 'amountRequired';
  else {
    const amount = parseAmount(form.amount);
    if (amount === null || amount <= 0) errors.amount = 'amountInvalid';
    else if (amount > MAX_AMOUNT) errors.amount = 'amountTooLarge';
  }

  const interval = wholeNumber(form.interval);
  if (interval === null || interval < 1 || interval > MAX_INTERVAL) {
    errors.interval = 'intervalInvalid';
  }

  if (!isDayKey(form.startDate)) errors.startDate = 'startDateRequired';
  else if (form.endDate && form.endDate < form.startDate) {
    errors.endDate = 'endBeforeStart';
  }

  if (form.kind === 'installment') {
    const total = wholeNumber(form.installmentsTotal);
    if (!form.installmentsTotal.trim()) {
      errors.installmentsTotal = 'installmentsRequired';
    } else if (total === null || total < 1 || total > 999) {
      errors.installmentsTotal = 'installmentsInvalid';
    }
    const paid = wholeNumber(form.installmentsPaid || '0');
    if (paid === null) errors.installmentsPaid = 'installmentsPaidInvalid';
    else if (total !== null && total >= 1 && paid > total) {
      errors.installmentsPaid = 'installmentsPaidTooMany';
    }
  }

  if (form.merchantPattern.trim().length > PATTERN_MAX) {
    errors.merchantPattern = 'patternTooLong';
  }
  if (form.notes.trim().length > NOTES_MAX) errors.notes = 'notesTooLong';
  return errors;
}

export function hasErrors(errors: FormErrors): boolean {
  return Object.keys(errors).length > 0;
}

type Input = Record<string, unknown>;

const optional = (text: string) => text.trim() || null;
const dateInput = (day: string) => (day ? startOfDayIso(day) : null);

/** Every field as the API takes it (null = empty optional field). */
function normalized(form: RecurringForm) {
  const installment = form.kind === 'installment';
  return {
    name: form.name.trim(),
    kind: form.kind,
    trackingMode: form.trackingMode,
    frequency: form.frequency,
    interval: wholeNumber(form.interval) ?? 1,
    startDate: dateInput(form.startDate),
    endDate: dateInput(form.endDate),
    amount: parseAmount(form.amount) ?? 0,
    isVariableAmount: form.isVariableAmount,
    currency: form.currency,
    accountId: optional(form.accountId),
    categoryId: optional(form.categoryId),
    merchantPattern: optional(form.merchantPattern)?.toUpperCase() ?? null,
    installmentsTotal: installment ? wholeNumber(form.installmentsTotal) : null,
    installmentsPaid: installment
      ? (wholeNumber(form.installmentsPaid || '0') ?? 0)
      : null,
    notes: optional(form.notes),
  };
}

/** CreateRecurringExpenseInput; empty optional fields are left out. */
export function buildCreateInput(form: RecurringForm): Input {
  const all = normalized(form);
  const input: Input = {};
  for (const [key, value] of Object.entries(all)) {
    if (value !== null) input[key] = value;
  }
  return input;
}

/** Fields the edit dialog can change (the currency is fixed once created). */
const UPDATABLE = [
  'name',
  'kind',
  'trackingMode',
  'frequency',
  'interval',
  'startDate',
  'endDate',
  'amount',
  'isVariableAmount',
  'accountId',
  'categoryId',
  'merchantPattern',
  'installmentsTotal',
  'installmentsPaid',
  'notes',
] as const;

/**
 * UpdateRecurringExpenseInput with only what changed (null clears an
 * optional field), or null when nothing did. Sending unchanged schedule
 * fields would make the API regenerate the pending payments for nothing.
 */
export function buildUpdateInput(
  form: RecurringForm,
  initial: RecurringForm,
): Input | null {
  const next = normalized(form);
  const before = normalized(initial);
  const input: Input = {};
  for (const key of UPDATABLE) {
    if (next[key] === before[key]) continue;
    // Leaving the installment kind keeps the old counts; nothing to clear.
    if (
      (key === 'installmentsTotal' || key === 'installmentsPaid') &&
      next[key] === null
    ) {
      continue;
    }
    input[key] = next[key];
  }
  return Object.keys(input).length > 0 ? input : null;
}

/**
 * acceptRecurringSuggestion's overrides, plus an update for the fields that
 * mutation doesn't take (end date, merchant text, installments, notes).
 * Choosing "meses sin intereses" goes in that update too: the API needs the
 * number of installments, which the accept input can't carry.
 */
export function buildAcceptInput(
  form: RecurringForm,
  suggested: RecurringForm,
): { input: Input; followUp: Input | null } {
  const all = normalized(form);
  const toInstallment =
    form.kind === 'installment' && suggested.kind !== 'installment';
  const input: Input = {
    name: all.name,
    ...(toInstallment ? {} : { kind: all.kind }),
    categoryId: all.categoryId,
    amount: all.amount,
    isVariableAmount: all.isVariableAmount,
    frequency: all.frequency,
    interval: all.interval,
    trackingMode: all.trackingMode,
    accountId: all.accountId,
  };
  const before = normalized(suggested);
  // The API starts from the oldest movement; only a new date is sent.
  if (all.startDate !== before.startDate) input.startDate = all.startDate;
  const followUp: Input = {};
  for (const key of [
    'endDate',
    'merchantPattern',
    'installmentsTotal',
    'installmentsPaid',
    'notes',
  ] as const) {
    if (all[key] !== before[key] && all[key] !== null) followUp[key] = all[key];
  }
  if (toInstallment) followUp.kind = 'installment';
  return {
    input,
    followUp: Object.keys(followUp).length > 0 ? followUp : null,
  };
}
