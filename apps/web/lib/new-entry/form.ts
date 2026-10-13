import { isDayKey, type DayKey } from '@/lib/finance/dates';
import { DEFAULT_CURRENCY, roundCents } from '@/lib/finance/money';
import type { EntryAccount } from './graphql';

/**
 * The create flow's forms as plain data: parsing, validation and the inputs
 * sent to the API. Errors are message keys under `newEntry.validation`.
 */
export type EntryKind = 'expense' | 'income' | 'transfer';

/** Largest amount accepted (the API stores DECIMAL(18,2); this is plenty). */
export const MAX_AMOUNT = 999_999_999.99;

/** Gasto or ingreso, as typed in the form. */
export interface EntryDraft {
  type: 'expense' | 'income';
  /** What the user typed: "1,234.50", "$80", "99.9". */
  amount: string;
  accountId: string | undefined;
  /** 'YYYY-MM-DD', Mexico City calendar day. */
  date: DayKey | undefined;
  merchant: string;
  note: string;
  categoryId: string | undefined;
  /** The user chose the category: suggestions no longer replace it. */
  categoryPicked: boolean;
}

export interface TransferDraft {
  amount: string;
  fromAccountId: string | undefined;
  toAccountId: string | undefined;
  date: DayKey | undefined;
  description: string;
}

export type ValidationKey =
  | 'amountRequired'
  | 'amountInvalid'
  | 'amountTooLarge'
  | 'accountRequired'
  | 'dateRequired'
  | 'dateInFuture'
  | 'fromRequired'
  | 'toRequired'
  | 'sameAccount'
  | 'currencyMismatch';

export type EntryErrors = Partial<
  Record<'amount' | 'accountId' | 'date', ValidationKey>
>;
export type TransferErrors = Partial<
  Record<'amount' | 'fromAccountId' | 'toAccountId' | 'date', ValidationKey>
>;

export function emptyEntryDraft(
  type: EntryDraft['type'],
  today: DayKey,
): EntryDraft {
  return {
    type,
    amount: '',
    accountId: undefined,
    date: today,
    merchant: '',
    note: '',
    categoryId: undefined,
    categoryPicked: false,
  };
}

export function emptyTransferDraft(today: DayKey): TransferDraft {
  return {
    amount: '',
    fromAccountId: undefined,
    toAccountId: undefined,
    date: today,
    description: '',
  };
}

/**
 * The amount typed by the user, in units with cents, or null when it is not
 * a number. Accepts "$1,234.50", "1234.5" and "80" (commas group thousands,
 * as written in Mexico); more than two decimals are rounded to cents.
 */
export function parseAmount(text: string): number | null {
  const cleaned = text.replace(/[\s$]/g, '').replace(/,/g, '');
  if (!/^\d+(\.\d*)?$|^\.\d+$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? roundCents(value) : null;
}

function amountError(text: string): ValidationKey | undefined {
  if (!text.trim()) return 'amountRequired';
  const value = parseAmount(text);
  if (value === null || value <= 0) return 'amountInvalid';
  if (value > MAX_AMOUNT) return 'amountTooLarge';
  return undefined;
}

function dateError(
  date: DayKey | undefined,
  today: DayKey,
): ValidationKey | undefined {
  if (!date || !isDayKey(date)) return 'dateRequired';
  if (date > today) return 'dateInFuture';
  return undefined;
}

function withoutEmpty<T extends object>(errors: T): T {
  return Object.fromEntries(
    Object.entries(errors).filter(([, value]) => value !== undefined),
  ) as T;
}

export function validateEntry(draft: EntryDraft, today: DayKey): EntryErrors {
  return withoutEmpty<EntryErrors>({
    amount: amountError(draft.amount),
    accountId: draft.accountId ? undefined : 'accountRequired',
    date: dateError(draft.date, today),
  });
}

export function validateTransfer(
  draft: TransferDraft,
  accounts: ReadonlyArray<Pick<EntryAccount, 'id' | 'currency'>>,
  today: DayKey,
): TransferErrors {
  const from = accounts.find((a) => a.id === draft.fromAccountId);
  const to = accounts.find((a) => a.id === draft.toAccountId);
  let toError: ValidationKey | undefined;
  if (!draft.toAccountId) toError = 'toRequired';
  else if (draft.toAccountId === draft.fromAccountId) toError = 'sameAccount';
  else if (from && to && from.currency !== to.currency) {
    toError = 'currencyMismatch';
  }
  return withoutEmpty<TransferErrors>({
    amount: amountError(draft.amount),
    fromAccountId: draft.fromAccountId ? undefined : 'fromRequired',
    toAccountId: toError,
    date: dateError(draft.date, today),
  });
}

export const hasErrors = (errors: object) => Object.keys(errors).length > 0;

const trimmedOrNull = (text: string) => text.trim() || null;

/** The account's currency, or MXN when none is chosen yet. */
export function currencyOf(
  accounts: ReadonlyArray<Pick<EntryAccount, 'id' | 'currency'>>,
  accountId: string | undefined,
): string {
  return accounts.find((a) => a.id === accountId)?.currency ?? DEFAULT_CURRENCY;
}

export interface CreateTransactionPayload {
  accountId: string;
  type: 'expense' | 'income';
  amount: number;
  currency: string;
  /** Date-only 'YYYY-MM-DD': the API stores it as that calendar day. */
  txnDate: DayKey;
  merchantName: string | null;
  description: string | null;
  categoryId: string | null;
}

/** The createTransaction input for a valid draft (validate first). */
export function buildTransactionInput(
  draft: EntryDraft,
  account: Pick<EntryAccount, 'id' | 'currency'>,
): CreateTransactionPayload {
  return {
    accountId: account.id,
    type: draft.type,
    amount: parseAmount(draft.amount)!,
    currency: account.currency,
    txnDate: draft.date!,
    merchantName: trimmedOrNull(draft.merchant),
    description: trimmedOrNull(draft.note),
    categoryId: draft.categoryId ?? null,
  };
}

export interface CreateTransferPayload {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  txnDate: DayKey;
  description: string;
}

/**
 * The createTransfer input for a valid draft. Without a description the
 * API would write an English one, so a default in the user's language is
 * sent instead (`defaultDescription`).
 */
export function buildTransferInput(
  draft: TransferDraft,
  defaultDescription: string,
): CreateTransferPayload {
  return {
    fromAccountId: draft.fromAccountId!,
    toAccountId: draft.toAccountId!,
    amount: parseAmount(draft.amount)!,
    txnDate: draft.date!,
    description: draft.description.trim() || defaultDescription,
  };
}

/** Variables of similarTransactions for the transaction about to be created. */
export function similarTransactionsArgs(payload: CreateTransactionPayload): {
  accountId: string;
  amount: number;
  date: DayKey;
  type: 'expense' | 'income';
} {
  return {
    accountId: payload.accountId,
    amount: payload.amount,
    date: payload.txnDate,
    type: payload.type,
  };
}

/** Text worth asking a category suggestion for (trimmed, 3+ characters). */
export function merchantQuery(merchant: string): string | null {
  const text = merchant.trim();
  return text.length >= 3 ? text : null;
}

/**
 * The draft with a suggested category applied, unless the user already
 * chose one (or there is no suggestion). Returns the same object when
 * nothing changes, so it can run in an effect.
 */
export function applySuggestedCategory(
  draft: EntryDraft,
  suggestedId: string | null,
): EntryDraft {
  if (!suggestedId || draft.categoryPicked) return draft;
  if (draft.categoryId === suggestedId) return draft;
  return { ...draft, categoryId: suggestedId };
}
