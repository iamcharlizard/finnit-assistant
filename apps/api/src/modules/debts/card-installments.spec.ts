import {
  billedInstallments,
  defaultSchedule,
  moveInstallment,
  scheduleError,
  cycleInstallments,
  fitsInstallment,
  fitsPurchase,
  firstInstallmentDay,
  installmentDays,
  planInstallments,
  type InstallmentPlan,
} from './card-installments';

const terms = { statementDay: 7, paymentDueDay: 27 };

describe('card purchases in installments', () => {
  it('bills the first installment on the cut-off of the cycle of the purchase', () => {
    expect(firstInstallmentDay('2026-10-20', terms)).toBe('2026-11-07');
    expect(firstInstallmentDay('2026-11-07', terms)).toBe('2026-11-07');
    expect(firstInstallmentDay('2026-11-08', terms)).toBe('2026-12-07');
  });

  it('bills one installment per cut-off, clamped to short months', () => {
    expect(
      installmentDays('2026-12-20', 4, { statementDay: 31, paymentDueDay: 20 }),
    ).toEqual(['2026-12-31', '2027-01-31', '2027-02-28', '2027-03-31']);
  });

  it('without terms, bills a month after the purchase and monthly', () => {
    expect(installmentDays('2026-01-31', 3, null)).toEqual([
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
  });

  it('counts the installments already billed', () => {
    expect(billedInstallments('2026-06-10', 12, terms, '2026-11-09')).toBe(5);
    expect(billedInstallments('2026-06-10', 3, terms, '2026-11-09')).toBe(3);
    expect(billedInstallments('2026-11-08', 3, terms, '2026-11-09')).toBe(0);
  });

  it('splits the total so the last installment takes the cents left', () => {
    const plan: InstallmentPlan = {
      debtId: 'd',
      name: 'Laptop',
      purchaseDay: '2026-10-20',
      count: 3,
      totalToRepay: 1000,
      installmentAmount: 333.33,
      purchaseChargedOn: null,
    };
    expect(planInstallments(plan, terms).map((i) => i.amount)).toEqual([
      333.33, 333.33, 333.34,
    ]);
  });

  it("splits a cycle's installments and those still to bill", () => {
    const plans: InstallmentPlan[] = [
      {
        debtId: 'in-balance',
        name: 'Laptop',
        purchaseDay: '2026-10-20',
        count: 6,
        totalToRepay: 6000,
        installmentAmount: 1000,
        purchaseChargedOn: '2026-10-20',
      },
      {
        debtId: 'monthly',
        name: 'Phone',
        purchaseDay: '2026-08-10',
        count: 3,
        totalToRepay: 900,
        installmentAmount: 300,
        purchaseChargedOn: null,
      },
    ];
    const cycle = { periodStart: '2026-10-08', statementDate: '2026-11-07' };
    const out = cycleInstallments(plans, terms, cycle);
    expect(out.inCycle).toBe(1300);
    expect(out.balance).toBe(5000);
    expect(out.deferred).toBe(5000);
    expect([...out.inBalance]).toEqual(['in-balance']);
    expect(out.rows).toEqual([
      expect.objectContaining({ debtId: 'in-balance', number: 1, total: 6 }),
      expect.objectContaining({ debtId: 'monthly', number: 3, left: 0 }),
    ]);

    // Before the purchase's charge, nothing is deferred.
    const before = cycleInstallments(plans, terms, {
      periodStart: '2026-09-08',
      statementDate: '2026-10-07',
    });
    expect(before.deferred).toBe(0);
    expect(before.inCycle).toBe(300);
  });

  it('recognizes the whole purchase and an installment by amount and date', () => {
    const plan = { principal: 6000, purchaseDay: '2026-10-20' };
    expect(fitsPurchase({ amount: 6000, day: '2026-10-22' }, plan)).toBe(true);
    expect(fitsPurchase({ amount: 6000, day: '2026-10-30' }, plan)).toBe(false);
    expect(fitsPurchase({ amount: 5000, day: '2026-10-20' }, plan)).toBe(false);
    const target = { amount: 1000, day: '2026-11-07' };
    expect(fitsInstallment({ amount: 1050, day: '2026-11-10' }, target)).toBe(
      true,
    );
    expect(fitsInstallment({ amount: 1300, day: '2026-11-07' }, target)).toBe(
      false,
    );
  });

  it('starts with equal installments on the cut-offs, the last with the cents left', () => {
    expect(defaultSchedule('2026-10-07', 3, terms, 998, 332.66)).toEqual([
      { day: '2026-10-07', amount: 332.66 },
      { day: '2026-11-07', amount: 332.66 },
      { day: '2026-12-07', amount: 332.68 },
    ]);
  });

  it('moves one installment, or the next ones to the same day', () => {
    const days = ['2026-10-16', '2026-11-16', '2026-12-16', '2027-01-16'];
    expect(moveInstallment(days, 0, '2026-10-07', false)).toEqual([
      '2026-10-07',
      '2026-11-16',
      '2026-12-16',
      '2027-01-16',
    ]);
    expect(moveInstallment(days, 1, '2026-11-30', true)).toEqual([
      '2026-10-16',
      '2026-11-30',
      '2026-12-30',
      '2027-01-30',
    ]);
    expect(moveInstallment(days, 2, '2027-01-31', true)).toEqual([
      '2026-10-16',
      '2026-11-16',
      '2027-01-31',
      '2027-02-28',
    ]);
  });

  it('keeps the days in order after the purchase and the amounts above 0', () => {
    const ok = [
      { day: '2026-10-07', amount: 500 },
      { day: '2026-10-17', amount: 500 },
    ];
    expect(scheduleError(ok, '2026-10-07')).toBeNull();
    expect(scheduleError(ok, '2026-10-08')).toBe('dates');
    expect(scheduleError([ok[1], ok[0]], '2026-10-01')).toBe('dates');
    expect(scheduleError([{ ...ok[0], amount: 0 }], '2026-10-01')).toBe(
      'amounts',
    );
  });
});
