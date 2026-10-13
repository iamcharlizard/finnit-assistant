import { parseAmount } from '@/lib/new-entry/form';
import type { MonthlyItem, MonthlyItemKind, OneTimeItem } from './scenario';

/**
 * The simulator's controls as typed: parsing and validation. Invalid
 * text keeps the last valid value out of the scenario and shows an error.
 */

export const MAX_AMOUNT = 999_999_999;
export const MIN_PERCENT = -100;
export const MAX_PERCENT = 1000;
export const ITEM_NAME_MAX = 60;

export type AmountErrorCode =
  | 'amountRequired'
  | 'amountInvalid'
  | 'amountTooLarge';

export type ParseResult =
  | { ok: true; value: number }
  | { ok: false; error: AmountErrorCode | 'percentInvalid' | 'percentRange' };

/** A money amount ≥ 0; '' is 0 only when `emptyIsZero`. */
export function parseMoneyField(
  text: string,
  { emptyIsZero = false }: { emptyIsZero?: boolean } = {},
): ParseResult {
  if (!text.trim()) {
    return emptyIsZero
      ? { ok: true, value: 0 }
      : { ok: false, error: 'amountRequired' };
  }
  const value = parseAmount(text);
  if (value === null) return { ok: false, error: 'amountInvalid' };
  if (value > MAX_AMOUNT) return { ok: false, error: 'amountTooLarge' };
  return { ok: true, value };
}

/** "-10", "+15", "12.5", "10 %"; '' is 0. Between −100 and 1000. */
export function parsePercentField(text: string): ParseResult {
  const cleaned = text.replace(/[\s%]/g, '');
  if (!cleaned) return { ok: true, value: 0 };
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(cleaned)) {
    return { ok: false, error: 'percentInvalid' };
  }
  const value = Number(cleaned);
  if (value < MIN_PERCENT || value > MAX_PERCENT) {
    return { ok: false, error: 'percentRange' };
  }
  return { ok: true, value: Math.round(value * 100) / 100 };
}

export interface MonthlyDraft {
  name: string;
  kind: MonthlyItemKind;
  amount: string;
}

export interface OneTimeDraft {
  name: string;
  amount: string;
  /** "1" … months. */
  month: string;
}

export type DraftErrorCode =
  | AmountErrorCode
  | 'nameTooLong'
  | 'amountZero'
  | 'monthInvalid';

export type DraftErrors = Partial<
  Record<'name' | 'amount' | 'month', DraftErrorCode>
>;

export const emptyMonthlyDraft = (): MonthlyDraft => ({
  name: '',
  kind: 'add',
  amount: '',
});

export const emptyOneTimeDraft = (): OneTimeDraft => ({
  name: '',
  amount: '',
  month: '1',
});

function draftAmountError(text: string): DraftErrorCode | undefined {
  const parsed = parseMoneyField(text);
  if (!parsed.ok) return parsed.error as AmountErrorCode;
  return parsed.value > 0 ? undefined : 'amountZero';
}

export function validateMonthlyDraft(draft: MonthlyDraft): DraftErrors {
  const errors: DraftErrors = {};
  if (draft.name.trim().length > ITEM_NAME_MAX) errors.name = 'nameTooLong';
  const amount = draftAmountError(draft.amount);
  if (amount) errors.amount = amount;
  return errors;
}

export function validateOneTimeDraft(
  draft: OneTimeDraft,
  months: number,
): DraftErrors {
  const errors: DraftErrors = {};
  if (draft.name.trim().length > ITEM_NAME_MAX) errors.name = 'nameTooLong';
  const amount = draftAmountError(draft.amount);
  if (amount) errors.amount = amount;
  const month = Number(draft.month);
  if (!Number.isInteger(month) || month < 1 || month > months) {
    errors.month = 'monthInvalid';
  }
  return errors;
}

/** Assumes a valid draft. */
export function toMonthlyItem(draft: MonthlyDraft, id: string): MonthlyItem {
  return {
    id,
    name: draft.name.trim(),
    kind: draft.kind,
    amount: parseAmount(draft.amount)!,
  };
}

/** Assumes a valid draft. */
export function toOneTimeItem(draft: OneTimeDraft, id: string): OneTimeItem {
  return {
    id,
    name: draft.name.trim(),
    amount: parseAmount(draft.amount)!,
    month: Number(draft.month),
  };
}
