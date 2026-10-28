import { dayKeyOf, isDayKey, type DayKey } from '@/lib/finance/dates';
import { DEFAULT_CURRENCY } from '@/lib/finance/money';
import type { ApiAccount } from '@/lib/finance/types';
import { parseAmount } from '@/lib/new-entry/form';
import type { ApiDebt, DebtKind } from './types';

/**
 * The debt dialog and the payment dialog: fields as typed, validation and
 * the API inputs.
 */
export interface DebtForm {
  name: string;
  kind: DebtKind;
  principal: string;
  /** Percent a year; '' = unknown. */
  rate: string;
  minPayment: string;
  /** 'YYYY-MM-DD' or ''. */
  startDate: string;
  dueDate: string;
  /** '' = none. */
  linkedAccountId: string;
}

export type DebtField = keyof DebtForm;

export type DebtErrorCode =
  | 'nameRequired'
  | 'nameTooLong'
  | 'principalRequired'
  | 'principalInvalid'
  | 'principalTooLarge'
  | 'principalBelowPaid'
  | 'rateInvalid'
  | 'minPaymentInvalid'
  | 'dueBeforeStart';

export type DebtFormErrors = Partial<Record<DebtField, DebtErrorCode>>;

export const NAME_MAX = 100;
export const MAX_AMOUNT = 999_999_999;
export const MAX_RATE = 100;

const amountText = (amount: number) =>
  Number.isInteger(amount) ? String(amount) : amount.toFixed(2);

export function newDebtForm(): DebtForm {
  return {
    name: '',
    kind: 'loan',
    principal: '',
    rate: '',
    minPayment: '',
    startDate: '',
    dueDate: '',
    linkedAccountId: '',
  };
}

export function formOfDebt(debt: ApiDebt): DebtForm {
  return {
    name: debt.name,
    kind: debt.kind,
    principal: amountText(debt.principal),
    rate:
      debt.interestRateAnnual != null
        ? String(Math.round(debt.interestRateAnnual * 10_000) / 10_000)
        : '',
    minPayment:
      debt.minPaymentAmount != null ? amountText(debt.minPaymentAmount) : '',
    startDate: debt.startDate ? dayKeyOf(debt.startDate) : '',
    dueDate: debt.dueDate ? dayKeyOf(debt.dueDate) : '',
    linkedAccountId: debt.linkedAccountId ?? '',
  };
}

/** "24.5", "24,5" or "24.5%"; null when it isn't a number. */
export function parseRate(text: string): number | null {
  const cleaned = text.trim().replace(/%$/, '').trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$|^\.\d+$/.test(cleaned)) return null;
  return Number(cleaned);
}

export function validateDebtForm(
  form: DebtForm,
  { paid = 0 }: { paid?: number } = {},
): DebtFormErrors {
  const errors: DebtFormErrors = {};
  const name = form.name.trim();
  if (!name) errors.name = 'nameRequired';
  else if (name.length > NAME_MAX) errors.name = 'nameTooLong';

  if (!form.principal.trim()) errors.principal = 'principalRequired';
  else {
    const principal = parseAmount(form.principal);
    if (principal === null || principal <= 0) {
      errors.principal = 'principalInvalid';
    } else if (principal > MAX_AMOUNT) errors.principal = 'principalTooLarge';
    else if (principal < paid) errors.principal = 'principalBelowPaid';
  }

  if (form.rate.trim()) {
    const rate = parseRate(form.rate);
    if (rate === null || rate < 0 || rate > MAX_RATE)
      errors.rate = 'rateInvalid';
  }

  if (form.minPayment.trim()) {
    const min = parseAmount(form.minPayment);
    if (min === null || min <= 0 || min > MAX_AMOUNT) {
      errors.minPayment = 'minPaymentInvalid';
    }
  }

  if (
    isDayKey(form.startDate) &&
    isDayKey(form.dueDate) &&
    form.dueDate < form.startDate
  ) {
    errors.dueDate = 'dueBeforeStart';
  }
  return errors;
}

export function hasErrors(errors: object): boolean {
  return Object.keys(errors).length > 0;
}

type Input = Record<string, unknown>;

/** Every field as the API takes it (null = empty optional field). */
function normalized(form: DebtForm) {
  return {
    name: form.name.trim(),
    kind: form.kind,
    principal: parseAmount(form.principal) ?? 0,
    interestRateAnnual: form.rate.trim() ? parseRate(form.rate) : null,
    minPaymentAmount: form.minPayment.trim()
      ? parseAmount(form.minPayment)
      : null,
    // Date-only 'YYYY-MM-DD': the API stores it as that calendar day.
    startDate: isDayKey(form.startDate) ? form.startDate : null,
    dueDate: isDayKey(form.dueDate) ? form.dueDate : null,
    linkedAccountId: form.linkedAccountId || null,
  };
}

/** CreateDebtInput; empty optional fields are left out. */
export function buildCreateDebtInput(form: DebtForm): Input {
  const input: Input = {};
  for (const [key, value] of Object.entries(normalized(form))) {
    if (value !== null) input[key] = value;
  }
  return input;
}

/**
 * UpdateDebtInput with only what changed (null clears an optional field),
 * or null when nothing did.
 */
export function buildUpdateDebtInput(
  form: DebtForm,
  initial: DebtForm,
): Input | null {
  const next = normalized(form);
  const before = normalized(initial);
  const input: Input = {};
  for (const key of Object.keys(next) as (keyof typeof next)[]) {
    if (next[key] !== before[key]) input[key] = next[key];
  }
  return Object.keys(input).length > 0 ? input : null;
}

// Payments

export interface PaymentForm {
  amount: string;
  /** 'YYYY-MM-DD'. */
  date: string;
  /** The account the money leaves from; '' until chosen. */
  accountId: string;
  /** Expense payments only; '' = no category. */
  categoryId: string;
}

export type PaymentField = keyof PaymentForm;

export type PaymentErrorCode =
  | 'amountRequired'
  | 'amountInvalid'
  | 'amountTooMuch'
  | 'dateRequired'
  | 'dateInFuture'
  | 'accountRequired';

export type PaymentFormErrors = Partial<Record<PaymentField, PaymentErrorCode>>;

/**
 * How a payment is recorded. Paying a debt linked to a credit card account
 * is moving money into that card: a transfer from the chosen account, which
 * lowers what the card owes without counting the money twice (the card's
 * purchases were already expenses). Any other debt (a loan, or a card that
 * isn't one of the user's accounts) is an expense from the chosen account.
 */
export type PaymentMode =
  | { kind: 'transfer'; card: ApiAccount }
  | { kind: 'expense' };

export function paymentMode(
  debt: Pick<ApiDebt, 'linkedAccountId'>,
  accounts: ReadonlyArray<ApiAccount>,
): PaymentMode {
  const linked = accounts.find((a) => a.id === debt.linkedAccountId);
  return linked?.type === 'credit' && !linked.archived
    ? { kind: 'transfer', card: linked }
    : { kind: 'expense' };
}

/**
 * Accounts a payment can come from. A transfer needs a non-credit account
 * in the card's currency (the API refuses transfers out of a card, between
 * currencies, or above the source's balance). An expense can come from any
 * open account in the debt's currency (debts are in the home currency).
 */
export function paymentSources(
  mode: PaymentMode,
  accounts: ReadonlyArray<ApiAccount>,
): ApiAccount[] {
  return accounts.filter((a) => {
    if (a.archived) return false;
    if (mode.kind === 'transfer') {
      return (
        a.type !== 'credit' &&
        a.id !== mode.card.id &&
        a.currency === mode.card.currency
      );
    }
    return a.currency === DEFAULT_CURRENCY;
  });
}

export function newPaymentForm(
  debt: Pick<ApiDebt, 'minPaymentAmount' | 'remainingBalance'>,
  { today, accountId = '' }: { today: DayKey; accountId?: string },
): PaymentForm {
  const suggested =
    debt.minPaymentAmount != null
      ? Math.min(debt.minPaymentAmount, debt.remainingBalance)
      : null;
  return {
    amount: suggested != null && suggested > 0 ? amountText(suggested) : '',
    date: today,
    accountId,
    categoryId: '',
  };
}

export function validatePaymentForm(
  form: PaymentForm,
  { remaining, today }: { remaining: number; today: DayKey },
): PaymentFormErrors {
  const errors: PaymentFormErrors = {};
  if (!form.amount.trim()) errors.amount = 'amountRequired';
  else {
    const amount = parseAmount(form.amount);
    if (amount === null || amount <= 0) errors.amount = 'amountInvalid';
    else if (amount > remaining + 0.001) errors.amount = 'amountTooMuch';
  }
  if (!isDayKey(form.date)) errors.date = 'dateRequired';
  else if (form.date > today) errors.date = 'dateInFuture';
  if (!form.accountId) errors.accountId = 'accountRequired';
  return errors;
}

/** The movement that records a valid payment, as the API takes it. */
export type PaymentMovement =
  | {
      kind: 'transfer';
      input: {
        fromAccountId: string;
        toAccountId: string;
        amount: number;
        txnDate: DayKey;
        description: string;
      };
    }
  | {
      kind: 'expense';
      input: {
        accountId: string;
        type: 'expense';
        amount: number;
        currency: string;
        txnDate: DayKey;
        merchantName: string;
        description: string;
        categoryId: string | null;
      };
    };

export function buildPaymentMovement(
  form: PaymentForm,
  {
    debt,
    mode,
    account,
    description,
  }: {
    debt: Pick<ApiDebt, 'name'>;
    mode: PaymentMode;
    /** The source account (form.accountId). */
    account: Pick<ApiAccount, 'id' | 'currency'>;
    /** "Pago de {debt}", in the user's language. */
    description: string;
  },
): PaymentMovement {
  const amount = parseAmount(form.amount)!;
  if (mode.kind === 'transfer') {
    return {
      kind: 'transfer',
      input: {
        fromAccountId: account.id,
        toAccountId: mode.card.id,
        amount,
        txnDate: form.date,
        description,
      },
    };
  }
  return {
    kind: 'expense',
    input: {
      accountId: account.id,
      type: 'expense',
      amount,
      currency: account.currency,
      txnDate: form.date,
      merchantName: debt.name,
      description,
      categoryId: form.categoryId || null,
    },
  };
}
