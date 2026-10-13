import type { MonthRef } from '@/lib/finance/dates';
import { roundCents } from '@/lib/finance/money';
import { parseAmount } from '@/lib/new-entry/form';
import type { CapSuggestion } from './suggestions';
import type { ApiBudget } from './types';

/**
 * The budget dialog: an optional overall limit and the category caps, as
 * typed; validation; and the createBudget / updateBudget inputs.
 */
export interface CapRow {
  /** Stable React key (a row can change category). */
  key: string;
  /** '' until a category is chosen. */
  categoryId: string;
  amount: string;
}

export interface BudgetForm {
  /** '' = no overall limit (the caps' sum is the budget). */
  total: string;
  caps: CapRow[];
}

export type BudgetErrorCode =
  | 'empty'
  | 'totalInvalid'
  | 'totalTooLarge'
  | 'categoryRequired'
  | 'categoryRepeated'
  | 'amountRequired'
  | 'amountInvalid'
  | 'amountTooLarge';

export interface BudgetFormErrors {
  form?: 'empty';
  total?: BudgetErrorCode;
  caps?: Record<
    string,
    { category?: BudgetErrorCode; amount?: BudgetErrorCode }
  >;
}

export const MAX_AMOUNT = 999_999_999;

const amountText = (amount: number) =>
  Number.isInteger(amount) ? String(amount) : amount.toFixed(2);

export function emptyBudgetForm(): BudgetForm {
  return { total: '', caps: [] };
}

export function formOfBudget(budget: ApiBudget): BudgetForm {
  return {
    total: budget.amountTotal != null ? amountText(budget.amountTotal) : '',
    caps: budget.categories.map((cap) => ({
      key: cap.id,
      categoryId: cap.categoryId,
      amount: amountText(cap.capAmount),
    })),
  };
}

export function formOfSuggestions(
  suggestions: ReadonlyArray<CapSuggestion>,
): BudgetForm {
  return {
    total: '',
    caps: suggestions.map((s) => ({
      key: `suggested-${s.categoryId}`,
      categoryId: s.categoryId,
      amount: amountText(s.cap),
    })),
  };
}

function amountError(
  text: string,
  { allowZero }: { allowZero: boolean },
): BudgetErrorCode | undefined {
  if (!text.trim()) return 'amountRequired';
  const value = parseAmount(text);
  if (value === null || value < 0 || (!allowZero && value === 0)) {
    return 'amountInvalid';
  }
  if (value > MAX_AMOUNT) return 'amountTooLarge';
  return undefined;
}

export function validateBudgetForm(form: BudgetForm): BudgetFormErrors {
  const errors: BudgetFormErrors = {};
  if (form.total.trim()) {
    const code = amountError(form.total, { allowZero: false });
    if (code)
      errors.total =
        code === 'amountTooLarge' ? 'totalTooLarge' : 'totalInvalid';
  }

  const seen = new Set<string>();
  const caps: NonNullable<BudgetFormErrors['caps']> = {};
  for (const row of form.caps) {
    const rowErrors: { category?: BudgetErrorCode; amount?: BudgetErrorCode } =
      {};
    if (!row.categoryId) rowErrors.category = 'categoryRequired';
    else if (seen.has(row.categoryId)) rowErrors.category = 'categoryRepeated';
    else seen.add(row.categoryId);
    const amount = amountError(row.amount, { allowZero: false });
    if (amount) rowErrors.amount = amount;
    if (rowErrors.category || rowErrors.amount) caps[row.key] = rowErrors;
  }
  if (Object.keys(caps).length > 0) errors.caps = caps;

  if (!form.total.trim() && form.caps.length === 0) errors.form = 'empty';
  return errors;
}

export function hasBudgetErrors(errors: BudgetFormErrors): boolean {
  return Boolean(errors.form || errors.total || errors.caps);
}

/** Sum of the caps typed so far (invalid amounts count as 0). */
export function capsSum(form: BudgetForm): number {
  return roundCents(
    form.caps.reduce((sum, row) => sum + (parseAmount(row.amount) ?? 0), 0),
  );
}

/**
 * An overall limit below the caps' sum: allowed (the caps are guides), but
 * worth pointing out.
 */
export function totalBelowCaps(form: BudgetForm): boolean {
  const total = parseAmount(form.total);
  return total !== null && total > 0 && total < capsSum(form);
}

function categoriesInput(form: BudgetForm) {
  return form.caps.map((row) => ({
    categoryId: row.categoryId,
    capAmount: parseAmount(row.amount) ?? 0,
  }));
}

/** CreateBudgetInput for a valid form. */
export function buildCreateBudgetInput(
  form: BudgetForm,
  { month, currency }: { month: MonthRef; currency: string },
): Record<string, unknown> {
  const total = parseAmount(form.total);
  return {
    year: month.year,
    month: month.month,
    currency,
    ...(total !== null ? { amountTotal: total } : {}),
    categories: categoriesInput(form),
  };
}

/**
 * UpdateBudgetInput for a valid form: the whole cap list (the API replaces
 * it; an empty list removes every cap) and the limit (null removes it).
 */
export function buildUpdateBudgetInput(
  form: BudgetForm,
): Record<string, unknown> {
  return {
    amountTotal: parseAmount(form.total),
    categories: categoriesInput(form),
  };
}
