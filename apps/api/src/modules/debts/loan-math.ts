import { LoanInterestMode, RecurringFrequency } from '@finnit/database';
import {
  addDays,
  dueDatesAfter,
  periodsPerYear,
  ScheduleRule,
} from '../recurring-expenses/schedule.util';

/** VAT charged on loan interest in Mexico. */
export const INTEREST_VAT_RATE = 0.16;

const cents = (amount: number) => Math.round(amount * 100) / 100;

/** Rate per payment period as a fraction, VAT on interest included when asked. */
export function periodicRate(
  annualRatePercent: number,
  frequency: RecurringFrequency,
  includesVat = false,
): number {
  const rate = annualRatePercent / 100 / periodsPerYear(frequency);
  return includesVat ? rate * (1 + INTEREST_VAT_RATE) : rate;
}

/** Fixed payment that repays `principal` in `installments` periods (French amortization). */
export function frenchPayment(
  principal: number,
  rate: number,
  installments: number,
): number {
  if (installments <= 0) return 0;
  if (rate === 0) return principal / installments;
  return (principal * rate) / (1 - Math.pow(1 + rate, -installments));
}

export interface AmortizationRow {
  number: number;
  payment: number;
  /** Interest of the period, VAT excluded. */
  interest: number;
  vat: number;
  principal: number;
  /** Balance left after this payment. */
  balance: number;
}

export interface AmortizationInput {
  principal: number;
  annualRatePercent: number;
  installments: number;
  frequency: RecurringFrequency;
  includesVat?: boolean;
}

/**
 * Payment-by-payment table of a fixed-payment loan. Amounts are rounded to
 * cents; the last payment absorbs the rounding so the balance ends at 0.
 */
export function amortizationSchedule(
  input: AmortizationInput,
): AmortizationRow[] {
  const baseRate =
    input.annualRatePercent / 100 / periodsPerYear(input.frequency);
  const vatFactor = input.includesVat ? INTEREST_VAT_RATE : 0;
  const payment = cents(
    frenchPayment(
      input.principal,
      baseRate * (1 + vatFactor),
      input.installments,
    ),
  );

  const rows: AmortizationRow[] = [];
  let balance = input.principal;
  for (let number = 1; number <= input.installments; number += 1) {
    const interest = cents(balance * baseRate);
    const vat = cents(interest * vatFactor);
    const isLast = number === input.installments;
    const principal = isLast ? cents(balance) : cents(payment - interest - vat);
    balance = cents(balance - principal);
    rows.push({
      number,
      payment: isLast ? cents(principal + interest + vat) : payment,
      interest,
      vat,
      principal,
      balance,
    });
  }
  return rows;
}

/** `total` split into `installments` equal payments; the last takes the leftover cents. */
export function splitInstallments(
  total: number,
  installments: number,
): number[] {
  if (installments <= 0) return [];
  const each = Math.floor((total * 100) / installments) / 100;
  const last = cents(total - each * (installments - 1));
  return [...Array.from({ length: installments - 1 }, () => each), last];
}

export interface LoanTermsInput {
  mode: LoanInterestMode;
  principal: number;
  installments: number;
  frequency: RecurringFrequency;
  annualRatePercent?: number;
  includesVat?: boolean;
  totalToRepay?: number;
  installmentAmount?: number;
  /**
   * Fixed fee charged with every payment (administración, seguro), VAT
   * included. Rate mode only: a given total or payment already has it.
   */
  periodicFee?: number;
}

export interface LoanTerms {
  installmentAmount: number;
  totalToRepay: number;
  /** Interest (VAT included) = total to repay − principal − fees. */
  totalInterest: number;
  /** Fee per payment × payments. */
  totalFees: number;
}

export class LoanTermsError extends Error {}

/**
 * Completes the terms of a fixed-payment loan from whichever value the user
 * gave: the rate, the total to repay, or the amount of each payment.
 */
export function resolveLoanTerms(input: LoanTermsInput): LoanTerms {
  const { mode, principal, installments } = input;
  if (!(principal > 0)) throw new LoanTermsError('principal must be positive');
  if (!(Number.isInteger(installments) && installments > 0)) {
    throw new LoanTermsError('installments must be a positive integer');
  }

  let totalToRepay: number;
  let installmentAmount: number;
  let totalFees = 0;
  switch (mode) {
    case LoanInterestMode.rate: {
      if (input.annualRatePercent == null || input.annualRatePercent < 0) {
        throw new LoanTermsError('rate mode needs a non-negative annual rate');
      }
      const rows = amortizationSchedule({
        principal,
        annualRatePercent: input.annualRatePercent,
        installments,
        frequency: input.frequency,
        includesVat: input.includesVat,
      });
      const fee = cents(input.periodicFee ?? 0);
      if (fee < 0) throw new LoanTermsError('the fee cannot be negative');
      totalFees = cents(fee * installments);
      installmentAmount = cents(rows[0].payment + fee);
      totalToRepay = cents(
        rows.reduce((sum, row) => sum + row.payment, 0) + totalFees,
      );
      break;
    }
    case LoanInterestMode.total_amount: {
      if (input.totalToRepay == null) {
        throw new LoanTermsError('total_amount mode needs the total to repay');
      }
      totalToRepay = cents(input.totalToRepay);
      installmentAmount = splitInstallments(totalToRepay, installments)[0];
      break;
    }
    case LoanInterestMode.installment_amount: {
      if (input.installmentAmount == null || !(input.installmentAmount > 0)) {
        throw new LoanTermsError(
          'installment_amount mode needs the payment amount',
        );
      }
      installmentAmount = cents(input.installmentAmount);
      totalToRepay = cents(installmentAmount * installments);
      break;
    }
  }

  if (totalToRepay < principal) {
    throw new LoanTermsError(
      'total to repay cannot be less than the principal',
    );
  }
  return {
    installmentAmount,
    totalToRepay,
    totalInterest: cents(totalToRepay - principal - totalFees),
    totalFees,
  };
}

/** One purchase (or the initial amount) financed on the loan's due dates. */
export interface FinancedCharge {
  date: Date;
  totalToRepay: number;
  installments: number;
  /** The first ones, paid before registering it. */
  installmentsPaid?: number;
  /** When the first one is due; else the first due date after `date`. */
  firstPaymentDate?: Date | null;
  /** What was bought or lent, when said. */
  description?: string | null;
  /** The charge it is; null for the loan's first amount. */
  chargeId?: string | null;
}

export interface ScheduledInstallment {
  dueDate: Date;
  amount: number;
}

/** One installment of one charge: number `number` of `of`. */
export interface ChargeInstallment {
  number: number;
  of: number;
  amount: number;
  description: string | null;
  /** Paid before the charge was registered (a historical payment). */
  paid: boolean;
  /** The charge it belongs to; null for the loan's first amount. */
  chargeId: string | null;
}

/**
 * Due dates of a charge's installments: from its first payment date (a due
 * date of the loan on or after it), else from the first one after the
 * charge.
 */
export function chargeDueDates(
  rule: ScheduleRule,
  charge: Pick<FinancedCharge, 'date' | 'installments' | 'firstPaymentDate'>,
): Date[] {
  const after = charge.firstPaymentDate
    ? addDays(charge.firstPaymentDate, -1)
    : charge.date;
  return dueDatesAfter(rule, after, charge.installments);
}

/**
 * The installments of every charge by due date: each charge is split into
 * its own installments, which fall on the loan's due dates starting with
 * the first one after the charge. The first `installmentsPaid` are paid.
 */
export function chargeInstallments(
  rule: ScheduleRule,
  charges: FinancedCharge[],
): Map<number, ChargeInstallment[]> {
  const byDate = new Map<number, ChargeInstallment[]>();
  for (const charge of charges) {
    const dates = chargeDueDates(rule, charge);
    const amounts = splitInstallments(charge.totalToRepay, dates.length);
    dates.forEach((date, i) => {
      const key = date.getTime();
      const due = byDate.get(key) ?? [];
      due.push({
        number: i + 1,
        of: charge.installments,
        amount: amounts[i],
        description: charge.description ?? null,
        paid: i < (charge.installmentsPaid ?? 0),
        chargeId: charge.chargeId ?? null,
      });
      byDate.set(key, due);
    });
  }
  return byDate;
}

/** What is still due on a date: its installments not paid yet. */
export function amountDue(due: ChargeInstallment[]): number {
  return cents(
    due.filter((d) => !d.paid).reduce((sum, d) => sum + d.amount, 0),
  );
}

/**
 * Purchase financing (Kueski, Didi) and personal loans paid in installments:
 * the total due on each date (see `chargeInstallments`), leaving out dates
 * whose installments were all paid before registering them.
 */
export function purchaseFinancingSchedule(
  rule: ScheduleRule,
  charges: FinancedCharge[],
): ScheduledInstallment[] {
  return [...chargeInstallments(rule, charges).entries()]
    .sort(([a], [b]) => a - b)
    .map(([time, due]) => ({ dueDate: new Date(time), amount: amountDue(due) }))
    .filter((s) => s.amount > 0);
}

export interface BalanceInput {
  principal: number;
  totalToRepay?: number | null;
  charges: { totalToRepay: number }[];
  payments: { amount: number }[];
}

/** What is still owed: initial total + charges − every payment (historical ones too). */
export function debtBalance(input: BalanceInput): number {
  const owed =
    (input.totalToRepay ?? input.principal) +
    input.charges.reduce((sum, c) => sum + c.totalToRepay, 0);
  const paid = input.payments.reduce((sum, p) => sum + p.amount, 0);
  return Math.max(0, cents(owed - paid));
}
