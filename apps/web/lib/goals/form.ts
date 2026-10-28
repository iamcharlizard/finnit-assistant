import {
  dayKeyOf,
  isDayKey,
  startOfDayIso,
  type DayKey,
} from '@/lib/finance/dates';
import { DEFAULT_CURRENCY } from '@/lib/finance/money';
import { parseAmount } from '@/lib/new-entry/form';
import type { ApiGoal } from './types';

/**
 * The goal dialog and the "add contribution" form: fields as typed,
 * validation, and the API inputs.
 */
export interface GoalForm {
  name: string;
  targetAmount: string;
  currency: string;
  /** 'YYYY-MM-DD' or '' (no deadline). */
  dueDate: string;
  /** Only when creating: saved as the first contribution ('' = none). */
  initialAmount: string;
}

export type GoalFormField = keyof GoalForm;

export type GoalFormErrorCode =
  | 'nameRequired'
  | 'nameTooLong'
  | 'amountRequired'
  | 'amountInvalid'
  | 'amountTooLarge'
  | 'dueDateInPast'
  | 'initialInvalid'
  | 'initialTooLarge';

export type GoalFormErrors = Partial<Record<GoalFormField, GoalFormErrorCode>>;

export const NAME_MAX = 100;
export const MAX_AMOUNT = 999_999_999;

export function newGoalForm(currency = DEFAULT_CURRENCY): GoalForm {
  return {
    name: '',
    targetAmount: '',
    currency,
    dueDate: '',
    initialAmount: '',
  };
}

const amountText = (amount: number) =>
  Number.isInteger(amount) ? String(amount) : amount.toFixed(2);

export function formOfGoal(goal: ApiGoal): GoalForm {
  return {
    name: goal.name,
    targetAmount: amountText(goal.targetAmount),
    currency: goal.currency,
    dueDate: goal.dueDate ? dayKeyOf(goal.dueDate) : '',
    initialAmount: '',
  };
}

function amountError(
  text: string,
): 'amountRequired' | 'amountInvalid' | 'amountTooLarge' | undefined {
  if (!text.trim()) return 'amountRequired';
  const value = parseAmount(text);
  if (value === null || value <= 0) return 'amountInvalid';
  if (value > MAX_AMOUNT) return 'amountTooLarge';
  return undefined;
}

/**
 * `initial` is the goal being edited: a past due date it already had may
 * stay (the goal is overdue), a new one must be today or later.
 */
export function validateGoalForm(
  form: GoalForm,
  { today, initial }: { today: DayKey; initial?: GoalForm },
): GoalFormErrors {
  const errors: GoalFormErrors = {};
  const name = form.name.trim();
  if (!name) errors.name = 'nameRequired';
  else if (name.length > NAME_MAX) errors.name = 'nameTooLong';

  const target = amountError(form.targetAmount);
  if (target) errors.targetAmount = target;

  if (
    form.dueDate &&
    isDayKey(form.dueDate) &&
    form.dueDate < today &&
    form.dueDate !== initial?.dueDate
  ) {
    errors.dueDate = 'dueDateInPast';
  }

  if (!initial && form.initialAmount.trim()) {
    const value = parseAmount(form.initialAmount);
    if (value === null || value <= 0) errors.initialAmount = 'initialInvalid';
    else if (value > MAX_AMOUNT) errors.initialAmount = 'initialTooLarge';
  }
  return errors;
}

export function hasErrors(errors: object): boolean {
  return Object.keys(errors).length > 0;
}

export interface CreateGoalInput {
  name: string;
  targetAmount: number;
  currency: string;
  dueDate?: string;
}

/** Assumes a valid form. */
export function buildCreateGoalInput(form: GoalForm): CreateGoalInput {
  return {
    name: form.name.trim(),
    targetAmount: parseAmount(form.targetAmount)!,
    currency: form.currency,
    ...(form.dueDate ? { dueDate: startOfDayIso(form.dueDate) } : {}),
  };
}

export interface UpdateGoalInput {
  name?: string;
  targetAmount?: number;
  /** null clears the due date. */
  dueDate?: string | null;
}

/** Only what changed; null when nothing did. Assumes a valid form. */
export function buildUpdateGoalInput(
  form: GoalForm,
  initial: GoalForm,
): UpdateGoalInput | null {
  const input: UpdateGoalInput = {};
  const name = form.name.trim();
  if (name !== initial.name.trim()) input.name = name;
  const target = parseAmount(form.targetAmount)!;
  if (target !== parseAmount(initial.targetAmount)) input.targetAmount = target;
  if (form.dueDate !== initial.dueDate) {
    input.dueDate = form.dueDate ? startOfDayIso(form.dueDate) : null;
  }
  return Object.keys(input).length > 0 ? input : null;
}

export interface ContributionInput {
  goalId: string;
  amount: number;
  date: string;
}

/** The first contribution of a new goal, from its "already saved" field. */
export function initialContribution(
  form: GoalForm,
  goalId: string,
  today: DayKey,
): ContributionInput | null {
  const amount = form.initialAmount.trim()
    ? parseAmount(form.initialAmount)
    : null;
  if (!amount || amount <= 0) return null;
  return { goalId, amount, date: startOfDayIso(today) };
}

// Contributions

export interface ContributionForm {
  amount: string;
  /** 'YYYY-MM-DD' */
  date: string;
}

export type ContributionErrorCode =
  | 'amountRequired'
  | 'amountInvalid'
  | 'amountTooLarge'
  | 'dateRequired'
  | 'dateInFuture';

export type ContributionErrors = Partial<
  Record<keyof ContributionForm, ContributionErrorCode>
>;

export function newContributionForm(today: DayKey): ContributionForm {
  return { amount: '', date: today };
}

/** A contribution is money already set aside: no future dates. */
export function validateContributionForm(
  form: ContributionForm,
  today: DayKey,
): ContributionErrors {
  const errors: ContributionErrors = {};
  const amount = amountError(form.amount);
  if (amount) errors.amount = amount;
  if (!isDayKey(form.date)) errors.date = 'dateRequired';
  else if (form.date > today) errors.date = 'dateInFuture';
  return errors;
}

/** Assumes a valid form. */
export function buildContributionInput(
  goalId: string,
  form: ContributionForm,
): ContributionInput {
  return {
    goalId,
    amount: parseAmount(form.amount)!,
    date: startOfDayIso(form.date),
  };
}

/**
 * The "aportación mensual" box of the projection: a number ≥ 0, or null
 * while what is typed isn't one.
 */
export function parseMonthlyContribution(text: string): number | null {
  if (!text.trim()) return null;
  const value = parseAmount(text);
  return value === null || value > MAX_AMOUNT ? null : value;
}

export { amountText };
