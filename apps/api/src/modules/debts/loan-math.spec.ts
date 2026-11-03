import { LoanInterestMode, RecurringFrequency } from '@finnit/database';
import {
  amortizationSchedule,
  debtBalance,
  LoanTermsError,
  periodicRate,
  chargeInstallments,
  purchaseFinancingSchedule,
  resolveLoanTerms,
  splitInstallments,
} from './loan-math';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const iso = (date: Date) => date.toISOString().slice(0, 10);

describe('loan-math', () => {
  describe('periodicRate', () => {
    it('divides the annual rate by the payments per year', () => {
      expect(periodicRate(12, RecurringFrequency.monthly)).toBeCloseTo(0.01);
      expect(periodicRate(26, RecurringFrequency.biweekly)).toBeCloseTo(0.01);
      expect(periodicRate(24, RecurringFrequency.semimonthly)).toBeCloseTo(
        0.01,
      );
    });

    it('adds VAT on interest when asked', () => {
      expect(periodicRate(12, RecurringFrequency.monthly, true)).toBeCloseTo(
        0.0116,
      );
    });
  });

  describe('amortizationSchedule', () => {
    const rows = amortizationSchedule({
      principal: 10_000,
      annualRatePercent: 12,
      installments: 12,
      frequency: RecurringFrequency.monthly,
    });

    it('computes the fixed French payment', () => {
      expect(rows).toHaveLength(12);
      expect(rows[0].payment).toBe(888.49);
      expect(rows[0].interest).toBe(100);
    });

    it('ends at a zero balance with the last payment absorbing rounding', () => {
      expect(rows[11].balance).toBe(0);
      const principalPaid = rows.reduce((sum, r) => sum + r.principal, 0);
      expect(principalPaid).toBeCloseTo(10_000, 2);
      expect(Math.abs(rows[11].payment - 888.49)).toBeLessThan(0.1);
    });

    it('splits VAT from interest', () => {
      const withVat = amortizationSchedule({
        principal: 10_000,
        annualRatePercent: 12,
        installments: 12,
        frequency: RecurringFrequency.monthly,
        includesVat: true,
      });
      expect(withVat[0].interest).toBe(100);
      expect(withVat[0].vat).toBe(16);
      expect(withVat[0].payment).toBeGreaterThan(888.49);
      expect(withVat[11].balance).toBe(0);
    });

    it('handles a zero rate', () => {
      const flat = amortizationSchedule({
        principal: 1_200,
        annualRatePercent: 0,
        installments: 12,
        frequency: RecurringFrequency.monthly,
      });
      expect(flat.every((r) => r.payment === 100 && r.interest === 0)).toBe(
        true,
      );
    });
  });

  describe('splitInstallments', () => {
    it('puts the leftover cents on the last payment', () => {
      expect(splitInstallments(100, 3)).toEqual([33.33, 33.33, 33.34]);
    });
  });

  describe('resolveLoanTerms', () => {
    const base = {
      principal: 10_000,
      installments: 12,
      frequency: RecurringFrequency.monthly,
    };

    it('derives the payment and total from the rate', () => {
      const terms = resolveLoanTerms({
        ...base,
        mode: LoanInterestMode.rate,
        annualRatePercent: 12,
      });
      expect(terms.installmentAmount).toBe(888.49);
      expect(terms.totalToRepay).toBeCloseTo(10_661.85, 0);
      expect(terms.totalInterest).toBeCloseTo(terms.totalToRepay - 10_000, 2);
    });

    it('adds a fixed fee to every payment, apart from the interest', () => {
      // YoTePresto: $200,000 at 18.9% + VAT, 24 months, $257.76 + VAT a month.
      const terms = resolveLoanTerms({
        mode: LoanInterestMode.rate,
        principal: 200_000,
        installments: 24,
        frequency: RecurringFrequency.monthly,
        annualRatePercent: 18.9,
        includesVat: true,
        periodicFee: 299,
      });
      expect(terms.installmentAmount).toBe(10_667.13);
      expect(terms.totalFees).toBe(7_176);
      expect(terms.totalInterest).toBeCloseTo(
        terms.totalToRepay - 200_000 - 7_176,
        2,
      );
    });

    it('derives the payment from the total to repay', () => {
      expect(
        resolveLoanTerms({
          ...base,
          mode: LoanInterestMode.total_amount,
          totalToRepay: 12_000,
        }),
      ).toEqual({
        installmentAmount: 1_000,
        totalToRepay: 12_000,
        totalInterest: 2_000,
        totalFees: 0,
      });
    });

    it('derives the total from the payment amount', () => {
      expect(
        resolveLoanTerms({
          ...base,
          mode: LoanInterestMode.installment_amount,
          installmentAmount: 950,
        }),
      ).toEqual({
        installmentAmount: 950,
        totalToRepay: 11_400,
        totalInterest: 1_400,
        totalFees: 0,
      });
    });

    it('rejects a total lower than the principal', () => {
      expect(() =>
        resolveLoanTerms({
          ...base,
          mode: LoanInterestMode.total_amount,
          totalToRepay: 9_000,
        }),
      ).toThrow(LoanTermsError);
    });

    it('rejects a missing rate or non-integer installments', () => {
      expect(() =>
        resolveLoanTerms({ ...base, mode: LoanInterestMode.rate }),
      ).toThrow(LoanTermsError);
      expect(() =>
        resolveLoanTerms({
          ...base,
          installments: 2.5,
          mode: LoanInterestMode.installment_amount,
          installmentAmount: 100,
        }),
      ).toThrow(LoanTermsError);
    });
  });

  describe('chargeInstallments', () => {
    it('numbers each charge installment on its due date', () => {
      const rule = {
        frequency: RecurringFrequency.monthly,
        interval: 1,
        startDate: d('2026-11-10'),
      };
      const due = chargeInstallments(rule, [
        {
          date: d('2026-11-01'),
          totalToRepay: 3_000,
          installments: 3,
          description: 'Pantalla',
        },
        { date: d('2026-11-20'), totalToRepay: 500, installments: 2 },
      ]);
      expect(
        [...due].map(([time, parts]) => [
          iso(new Date(time)),
          parts.map(
            (p) => `${p.description ?? '-'} ${p.number}/${p.of} ${p.amount}`,
          ),
        ]),
      ).toEqual([
        ['2026-11-10', ['Pantalla 1/3 1000']],
        ['2026-12-10', ['Pantalla 2/3 1000', '- 1/2 250']],
        ['2027-01-10', ['Pantalla 3/3 1000', '- 2/2 250']],
      ]);
    });
  });

  describe('purchaseFinancingSchedule', () => {
    const rule = {
      frequency: RecurringFrequency.semimonthly,
      interval: 1,
      startDate: d('2026-10-15'),
    };

    it('adds each purchase installments onto the same due dates', () => {
      const schedule = purchaseFinancingSchedule(rule, [
        { date: d('2026-10-01'), totalToRepay: 1_200, installments: 4 },
        { date: d('2026-10-20'), totalToRepay: 600, installments: 2 },
      ]);
      expect(schedule.map((s) => [iso(s.dueDate), s.amount])).toEqual([
        ['2026-10-15', 300],
        ['2026-10-31', 600],
        ['2026-11-15', 600],
        ['2026-11-30', 300],
      ]);
    });

    it('starts after the purchase date, not on it', () => {
      const schedule = purchaseFinancingSchedule(rule, [
        { date: d('2026-10-15'), totalToRepay: 100, installments: 1 },
      ]);
      expect(iso(schedule[0].dueDate)).toBe('2026-10-31');
    });
  });

  describe('debtBalance', () => {
    it('subtracts every payment from the total plus charges', () => {
      expect(
        debtBalance({
          principal: 10_000,
          totalToRepay: 12_000,
          charges: [{ totalToRepay: 2_000 }],
          payments: [{ amount: 1_000 }, { amount: 500 }],
        }),
      ).toBe(12_500);
    });

    it('falls back to the principal and never goes negative', () => {
      expect(
        debtBalance({
          principal: 1_000,
          charges: [],
          payments: [{ amount: 1_500 }],
        }),
      ).toBe(0);
    });
  });
});
