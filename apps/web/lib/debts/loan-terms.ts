import { roundCents } from '@/lib/finance/money';
import type { LoanFrequency, LoanInterestMode } from './types';

/**
 * Preview of a loan's payments while its form is filled in. Mirrors the
 * API's loan math (apps/api/src/modules/debts/loan-math.ts), which computes
 * the stored values: French amortization per payment period, with optional
 * 16% VAT on the interest.
 */
export const INTEREST_VAT_RATE = 0.16;

const PERIODS_PER_YEAR: Record<LoanFrequency, number> = {
  weekly: 52,
  biweekly: 26,
  semimonthly: 24,
  monthly: 12,
};

export interface LoanTermsDraft {
  mode: LoanInterestMode;
  principal: number;
  installments: number;
  frequency: LoanFrequency;
  annualRate?: number | null;
  includesVat?: boolean;
  totalToRepay?: number | null;
  installmentAmount?: number | null;
  /** Rate mode: fixed fee added to every payment, VAT included. */
  periodicFee?: number | null;
}

export interface LoanTermsPreview {
  installmentAmount: number;
  totalToRepay: number;
  /** VAT included; fees apart. */
  interest: number;
  /** Fee per payment × payments (0 without one). */
  fees?: number;
}

/** The terms the API will store, or null while a needed value is missing. */
export function previewLoanTerms(
  draft: LoanTermsDraft,
): LoanTermsPreview | null {
  const { principal, installments } = draft;
  if (!(principal > 0) || !Number.isInteger(installments) || installments < 1)
    return null;

  let installmentAmount: number;
  let totalToRepay: number;
  let fees = 0;
  if (draft.mode === 'rate') {
    if (draft.annualRate == null || draft.annualRate < 0) return null;
    const base = draft.annualRate / 100 / PERIODS_PER_YEAR[draft.frequency];
    const vat = draft.includesVat ? INTEREST_VAT_RATE : 0;
    const rate = base * (1 + vat);
    installmentAmount = roundCents(
      rate === 0
        ? principal / installments
        : (principal * rate) / (1 - Math.pow(1 + rate, -installments)),
    );
    // Same rounding as the API's table: the last payment takes the rest.
    let balance = principal;
    let total = 0;
    for (let n = 1; n <= installments; n += 1) {
      const interest = roundCents(balance * base);
      const tax = roundCents(interest * vat);
      const paid =
        n === installments
          ? roundCents(balance)
          : roundCents(installmentAmount - interest - tax);
      total += n === installments ? paid + interest + tax : installmentAmount;
      balance = roundCents(balance - paid);
    }
    const fee = roundCents(Math.max(0, draft.periodicFee ?? 0));
    fees = roundCents(fee * installments);
    installmentAmount = roundCents(installmentAmount + fee);
    totalToRepay = roundCents(total + fees);
  } else if (draft.mode === 'total_amount') {
    if (draft.totalToRepay == null || !(draft.totalToRepay > 0)) return null;
    totalToRepay = roundCents(draft.totalToRepay);
    installmentAmount = Math.floor((totalToRepay * 100) / installments) / 100;
  } else {
    if (draft.installmentAmount == null || !(draft.installmentAmount > 0))
      return null;
    installmentAmount = roundCents(draft.installmentAmount);
    totalToRepay = roundCents(installmentAmount * installments);
  }
  return {
    installmentAmount,
    totalToRepay,
    interest: roundCents(totalToRepay - principal - fees),
    fees,
  };
}
