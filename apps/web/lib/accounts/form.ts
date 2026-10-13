import { roundCents } from '@/lib/finance/money';
import type { AccountType } from '@/lib/finance/types';
import { OTHER_BANK } from './banks';

/**
 * Manual accounts (feature 20) and account personalization (feature 18):
 * form state, validation and the payloads sent to the API. Pure functions,
 * shared by the wizard and the edit dialog.
 */

export const MANUAL_ACCOUNT_TYPES = [
  'debit',
  'credit',
  'cash',
  'savings',
] as const satisfies ReadonlyArray<AccountType>;
export type ManualAccountType = (typeof MANUAL_ACCOUNT_TYPES)[number];

export const CURRENCIES = ['MXN', 'USD'] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Must match the API's NICKNAME_MAX_LENGTH. */
export const NICKNAME_MAX_LENGTH = 40;
/** The API rejects rates above this (percent per year). */
export const MAX_INTEREST_RATE = 200;

const HEX = /^#[0-9a-f]{6}$/i;
const LAST4 = /^\d{4}$/;

/** preset: Finnit's look for the account type; solid: one color; gradient: two. */
export type DesignMode = 'preset' | 'solid' | 'gradient';

export interface DesignValue {
  mode: DesignMode;
  primary: string;
  secondary: string;
}

export const DEFAULT_PRIMARY = '#5B61C2';
export const DEFAULT_SECONDARY = '#00696E';

export function designValueOf(
  design: { primaryColor: string; secondaryColor: string | null } | null,
): DesignValue {
  if (!design) {
    return {
      mode: 'preset',
      primary: DEFAULT_PRIMARY,
      secondary: DEFAULT_SECONDARY,
    };
  }
  return {
    mode: design.secondaryColor ? 'gradient' : 'solid',
    primary: design.primaryColor,
    secondary: design.secondaryColor ?? DEFAULT_SECONDARY,
  };
}

export interface DesignInput {
  primaryColor: string;
  secondaryColor?: string;
}

/** What to store for a design: null keeps (or goes back to) the preset look. */
export function designInputOf(design: DesignValue): DesignInput | null {
  if (design.mode === 'preset') return null;
  const primaryColor = design.primary.toUpperCase();
  return design.mode === 'gradient'
    ? { primaryColor, secondaryColor: design.secondary.toUpperCase() }
    : { primaryColor };
}

/** Colors for the card preview (undefined: preset look). */
export function previewColors(design: DesignValue): {
  primaryColor?: string;
  secondaryColor?: string;
} {
  const input = designInputOf(design);
  return input ?? {};
}

/** "12,345.50", "$1,000", " 80 " → number; null when it isn't one. */
export function parseAmount(text: string): number | null {
  const clean = text.replace(/[\s$,]/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(clean) && !/^-?\.\d+$/.test(clean)) return null;
  const value = Number(clean);
  return Number.isFinite(value) ? roundCents(value) : null;
}

function parseDay(text: string): number | null {
  const value = Number(text.trim());
  return text.trim() !== '' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 31
    ? value
    : null;
}

/** Validation problems, by field; each code is `accounts.errors.<code>`. */
export type ErrorCode =
  | 'required'
  | 'bankRequired'
  | 'last4'
  | 'amount'
  | 'notNegative'
  | 'positive'
  | 'day'
  | 'rate'
  | 'nicknameLength'
  | 'hex';

// ---------------------------------------------------------------------------
// Wizard (new manual account)
// ---------------------------------------------------------------------------

export interface ManualAccountForm {
  type: ManualAccountType | null;
  /** A name from MEXICAN_BANKS, OTHER_BANK or ''. */
  bankChoice: string;
  bankOther: string;
  nickname: string;
  last4: string;
  currency: Currency;
  /** Debit, cash and savings: money in the account today. */
  balance: string;
  /** Credit: what is owed today. */
  debt: string;
  creditLimit: string;
  statementDay: string;
  paymentDueDay: string;
  /** Optional, percent per year. */
  interestRate: string;
  design: DesignValue;
}

export function emptyManualAccountForm(): ManualAccountForm {
  return {
    type: null,
    bankChoice: '',
    bankOther: '',
    nickname: '',
    last4: '',
    currency: 'MXN',
    balance: '',
    debt: '',
    creditLimit: '',
    statementDay: '',
    paymentDueDay: '',
    interestRate: '',
    design: designValueOf(null),
  };
}

export const WIZARD_STEPS = ['type', 'details', 'money', 'design'] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

export type FormErrors = Partial<Record<string, ErrorCode>>;

/** Cash has no bank or card number. */
export function hasBank(type: ManualAccountType | null): boolean {
  return type !== 'cash';
}

/** The bank's name as typed or chosen; null for cash or when missing. */
export function bankNameOf(
  form: Pick<ManualAccountForm, 'type' | 'bankChoice' | 'bankOther'>,
): string | null {
  if (!hasBank(form.type)) return null;
  const name =
    form.bankChoice === OTHER_BANK ? form.bankOther.trim() : form.bankChoice;
  return name || null;
}

function validateNickname(nickname: string, errors: FormErrors) {
  if (nickname.trim().length > NICKNAME_MAX_LENGTH) {
    errors.nickname = 'nicknameLength';
  }
}

function validateDesign(design: DesignValue, errors: FormErrors) {
  if (design.mode === 'preset') return;
  if (!HEX.test(design.primary)) errors.primary = 'hex';
  if (design.mode === 'gradient' && !HEX.test(design.secondary)) {
    errors.secondary = 'hex';
  }
}

function validateTerms(
  form: Pick<
    ManualAccountForm,
    'statementDay' | 'paymentDueDay' | 'interestRate'
  >,
  errors: FormErrors,
) {
  if (parseDay(form.statementDay) === null) errors.statementDay = 'day';
  if (parseDay(form.paymentDueDay) === null) errors.paymentDueDay = 'day';
  if (form.interestRate.trim() !== '') {
    const rate = parseAmount(form.interestRate);
    if (rate === null || rate < 0 || rate > MAX_INTEREST_RATE) {
      errors.interestRate = 'rate';
    }
  }
}

/** Problems in one step of the wizard (empty when it can go on). */
export function validateWizardStep(
  form: ManualAccountForm,
  step: WizardStep,
): FormErrors {
  const errors: FormErrors = {};
  switch (step) {
    case 'type':
      if (!form.type) errors.type = 'required';
      break;
    case 'details':
      // Savings may live outside a bank (e.g. a tanda); debit and credit can't.
      if (
        (form.type === 'debit' || form.type === 'credit') &&
        !bankNameOf(form)
      ) {
        errors.bank = 'bankRequired';
      }
      if (
        form.bankChoice === OTHER_BANK &&
        hasBank(form.type) &&
        !form.bankOther.trim()
      ) {
        errors.bank = 'bankRequired';
      }
      if (hasBank(form.type) && form.last4 && !LAST4.test(form.last4)) {
        errors.last4 = 'last4';
      }
      validateNickname(form.nickname, errors);
      break;
    case 'money':
      if (form.type === 'credit') {
        const debt = parseAmount(form.debt || '0');
        if (debt === null) errors.debt = 'amount';
        else if (debt < 0) errors.debt = 'notNegative';
        const limit = parseAmount(form.creditLimit);
        if (!form.creditLimit.trim()) errors.creditLimit = 'required';
        else if (limit === null) errors.creditLimit = 'amount';
        else if (limit <= 0) errors.creditLimit = 'positive';
        validateTerms(form, errors);
      } else {
        const balance = parseAmount(form.balance || '0');
        if (balance === null) errors.balance = 'amount';
        else if (balance < 0) errors.balance = 'notNegative';
      }
      break;
    case 'design':
      validateDesign(form.design, errors);
      break;
  }
  return errors;
}

/** Every step's problems, and the first step that has any. */
export function validateWizard(form: ManualAccountForm): {
  errors: FormErrors;
  firstInvalidStep: WizardStep | null;
} {
  let firstInvalidStep: WizardStep | null = null;
  const errors: FormErrors = {};
  for (const step of WIZARD_STEPS) {
    const found = validateWizardStep(form, step);
    if (Object.keys(found).length && !firstInvalidStep) firstInvalidStep = step;
    Object.assign(errors, found);
  }
  return { errors, firstInvalidStep };
}

/**
 * The account's name, which must be unique per user: "BBVA Crédito •1234",
 * "Nu Ahorro", "Efectivo". `typeLabel` is the translated type.
 */
export function deriveAccountName(
  form: Pick<ManualAccountForm, 'type' | 'bankChoice' | 'bankOther' | 'last4'>,
  typeLabel: string,
): string {
  const bank = bankNameOf(form);
  const base = [bank, typeLabel].filter(Boolean).join(' ');
  return hasBank(form.type) && LAST4.test(form.last4)
    ? `${base} •${form.last4}`
    : base;
}

/** `base`, or "base (2)", "base (3)"… when the user already has that name. */
export function uniqueAccountName(
  base: string,
  existing: ReadonlyArray<string>,
): string {
  const taken = new Set(existing.map((n) => n.trim().toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base} (${n})`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

export interface CreateAccountInput {
  type: ManualAccountType;
  name: string;
  currency: Currency;
  initialBalance: number;
  metadata: {
    bank?: string;
    last4?: string;
    nickname?: string;
    creditLimit?: number;
    design?: DesignInput;
  };
}

/**
 * Opening balance as the API stores it. A credit card's balance is negative
 * when it owes, so a debt of 12,450 opens at -12,450.
 */
export function openingBalance(form: ManualAccountForm): number {
  if (form.type === 'credit') {
    const debt = parseAmount(form.debt || '0') ?? 0;
    return debt === 0 ? 0 : -Math.abs(debt);
  }
  return parseAmount(form.balance || '0') ?? 0;
}

export function buildCreateAccountInput(
  form: ManualAccountForm,
  name: string,
): CreateAccountInput {
  if (!form.type) throw new Error('The account type is missing');
  const bank = bankNameOf(form);
  const nickname = form.nickname.trim();
  const design = designInputOf(form.design);
  const metadata: CreateAccountInput['metadata'] = {
    ...(bank && { bank }),
    ...(hasBank(form.type) && LAST4.test(form.last4) && { last4: form.last4 }),
    ...(nickname && { nickname }),
    ...(design && { design }),
  };
  if (form.type === 'credit') {
    const limit = parseAmount(form.creditLimit);
    if (limit && limit > 0) metadata.creditLimit = limit;
  }
  return {
    type: form.type,
    name,
    currency: form.currency,
    initialBalance: openingBalance(form),
    metadata,
  };
}

export interface CreditTermsInput {
  statementDay: number;
  paymentDueDay: number;
  interestRateAnnual?: number;
}

export function buildCreditTermsInput(
  form: Pick<
    ManualAccountForm,
    'statementDay' | 'paymentDueDay' | 'interestRate'
  >,
): CreditTermsInput {
  const statementDay = parseDay(form.statementDay);
  const paymentDueDay = parseDay(form.paymentDueDay);
  if (statementDay === null || paymentDueDay === null) {
    throw new Error('Invalid credit card days');
  }
  const rate = form.interestRate.trim() ? parseAmount(form.interestRate) : null;
  return {
    statementDay,
    paymentDueDay,
    ...(rate !== null && { interestRateAnnual: rate }),
  };
}

// ---------------------------------------------------------------------------
// Edit an existing account
// ---------------------------------------------------------------------------

/** What the edit dialog starts from (plain data from the server). */
export interface AccountEditValues {
  type: AccountType;
  /** Imported from a bank connection: bank fields are read-only. */
  linked: boolean;
  archived: boolean;
  nickname: string | null;
  design: { primaryColor: string; secondaryColor: string | null } | null;
  bank: string | null;
  last4: string | null;
  creditLimit: number | null;
  terms: {
    statementDay: number;
    paymentDueDay: number;
    interestRateAnnual: number | null;
  } | null;
}

export interface AccountEditForm {
  nickname: string;
  design: DesignValue;
  bankChoice: string;
  bankOther: string;
  last4: string;
  creditLimit: string;
  hasTerms: boolean;
  statementDay: string;
  paymentDueDay: string;
  interestRate: string;
}

export function editFormOf(
  values: AccountEditValues,
  bankChoice: { choice: string; other: string },
): AccountEditForm {
  return {
    nickname: values.nickname ?? '',
    design: designValueOf(values.design),
    bankChoice: bankChoice.choice,
    bankOther: bankChoice.other,
    last4: values.last4 ?? '',
    creditLimit: values.creditLimit != null ? String(values.creditLimit) : '',
    hasTerms: values.terms !== null,
    statementDay: values.terms ? String(values.terms.statementDay) : '',
    paymentDueDay: values.terms ? String(values.terms.paymentDueDay) : '',
    interestRate:
      values.terms?.interestRateAnnual != null
        ? String(values.terms.interestRateAnnual)
        : '',
  };
}

export function validateEdit(
  form: AccountEditForm,
  values: Pick<AccountEditValues, 'type' | 'linked'>,
): FormErrors {
  const errors: FormErrors = {};
  validateNickname(form.nickname, errors);
  validateDesign(form.design, errors);
  if (!values.linked && values.type !== 'cash') {
    if (form.bankChoice === OTHER_BANK && !form.bankOther.trim()) {
      errors.bank = 'bankRequired';
    }
    if (form.last4 && !LAST4.test(form.last4)) errors.last4 = 'last4';
    if (values.type === 'credit' && form.creditLimit.trim()) {
      const limit = parseAmount(form.creditLimit);
      if (limit === null) errors.creditLimit = 'amount';
      else if (limit <= 0) errors.creditLimit = 'positive';
    }
  }
  if (values.type === 'credit' && form.hasTerms) validateTerms(form, errors);
  return errors;
}

/** Metadata fields to change: `null` removes one (the API merges). */
export type MetadataPatch = Partial<{
  nickname: string | null;
  design: DesignInput | null;
  bank: string | null;
  last4: string | null;
  creditLimit: number | null;
}>;

function sameDesign(a: DesignInput | null, b: AccountEditValues['design']) {
  if (!a || !b) return a === null && b === null;
  return (
    a.primaryColor.toUpperCase() === b.primaryColor.toUpperCase() &&
    (a.secondaryColor ?? null)?.toUpperCase() ===
      (b.secondaryColor ?? null)?.toUpperCase()
  );
}

/** Only what changed; null when nothing did. */
export function buildMetadataPatch(
  form: AccountEditForm,
  initial: AccountEditValues,
): MetadataPatch | null {
  const patch: MetadataPatch = {};

  const nickname = form.nickname.trim() || null;
  if (nickname !== (initial.nickname?.trim() || null))
    patch.nickname = nickname;

  const design = designInputOf(form.design);
  if (!sameDesign(design, initial.design)) patch.design = design;

  if (!initial.linked && initial.type !== 'cash') {
    const bank =
      (form.bankChoice === OTHER_BANK
        ? form.bankOther.trim()
        : form.bankChoice) || null;
    if (bank !== (initial.bank || null)) patch.bank = bank;

    const last4 = form.last4.trim() || null;
    if (last4 !== (initial.last4 || null)) patch.last4 = last4;

    if (initial.type === 'credit') {
      const limit = form.creditLimit.trim()
        ? parseAmount(form.creditLimit)
        : null;
      if (limit !== (initial.creditLimit ?? null)) patch.creditLimit = limit;
    }
  }

  return Object.keys(patch).length ? patch : null;
}

export type TermsChange =
  | { kind: 'set'; input: CreditTermsInput }
  | { kind: 'remove' }
  | null;

/** Whether the credit card's terms have to be saved or removed. */
export function buildTermsChange(
  form: AccountEditForm,
  initial: AccountEditValues,
): TermsChange {
  if (initial.type !== 'credit') return null;
  if (!form.hasTerms) return initial.terms ? { kind: 'remove' } : null;
  const input = buildCreditTermsInput(form);
  const before = initial.terms;
  if (
    before &&
    before.statementDay === input.statementDay &&
    before.paymentDueDay === input.paymentDueDay &&
    (before.interestRateAnnual ?? null) === (input.interestRateAnnual ?? null)
  ) {
    return null;
  }
  return { kind: 'set', input };
}
