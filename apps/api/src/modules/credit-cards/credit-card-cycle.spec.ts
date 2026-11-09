import {
  balanceAt,
  creditsIn,
  cycleFigures,
  cycleOf,
  cyclesBefore,
  dayOfMonth,
  dueDateAfter,
  interestEstimate,
  payingCycle,
  remindersOn,
  statementOn,
} from './credit-card-cycle';

describe('credit card cycles', () => {
  const terms = { statementDay: 7, paymentDueDay: 27 };

  it('clamps the day to the month', () => {
    expect(dayOfMonth(2026, 2, 31)).toBe('2026-02-28');
    expect(dayOfMonth(2028, 2, 31)).toBe('2028-02-29');
    expect(dayOfMonth(2026, 13, 5)).toBe('2027-01-05');
    expect(dayOfMonth(2026, 0, 31)).toBe('2025-12-31');
  });

  it('finds the cut-off of the cycle a day falls in', () => {
    expect(statementOn('2026-11-07', terms)).toBe('2026-11-07');
    expect(statementOn('2026-11-08', terms)).toBe('2026-12-07');
    expect(statementOn('2026-12-20', terms)).toBe('2027-01-07');
    // Cut-off on the 31st: the month's last day.
    expect(statementOn('2026-02-10', { ...terms, statementDay: 31 })).toBe(
      '2026-02-28',
    );
  });

  it('dates a cycle from the day after the previous cut-off', () => {
    expect(cycleOf('2026-11-07', terms)).toEqual({
      periodStart: '2026-10-08',
      statementDate: '2026-11-07',
      paymentDueDate: '2026-11-27',
    });
    // The due day is before the cut-off day: next month.
    expect(
      dueDateAfter('2026-11-20', { statementDay: 20, paymentDueDay: 10 }),
    ).toBe('2026-12-10');
    expect(
      cycleOf('2026-03-31', { statementDay: 31, paymentDueDay: 20 }),
    ).toEqual({
      periodStart: '2026-03-01',
      statementDate: '2026-03-31',
      paymentDueDate: '2026-04-20',
    });
  });

  it('lists cycles newest first, and pages before a cut-off', () => {
    const cycles = cyclesBefore('2026-11-08', terms, 3);
    expect(cycles.map((c) => c.statementDate)).toEqual([
      '2026-12-07',
      '2026-11-07',
      '2026-10-07',
    ]);
    expect(
      cyclesBefore('2026-11-08', terms, 2, '2026-10-07').map(
        (c) => c.statementDate,
      ),
    ).toEqual(['2026-09-07', '2026-08-07']);
    expect(payingCycle('2026-11-08', terms).statementDate).toBe('2026-11-07');
    expect(payingCycle('2026-11-07', terms).statementDate).toBe('2026-10-07');
  });

  // Debt of 5,000 today. After the cut-off (Nov 7): a 1,000 charge on the
  // 10th, a 3,000 payment on the 15th. Before it: a 500 advance payment.
  const movements = [
    { day: '2026-11-01', effect: 500 },
    { day: '2026-11-10', effect: -1000 },
    { day: '2026-11-15', effect: 3000 },
  ];

  it('takes the balance at the cut-off back from today', () => {
    expect(balanceAt('2026-11-07', -5000, movements)).toBe(-7000);
    expect(balanceAt('2026-11-20', -5000, movements)).toBe(-5000);
    expect(creditsIn('2026-11-07', '2026-11-27', movements)).toBe(3000);
    expect(
      creditsIn('2026-11-07', '2026-11-27', [
        { day: '2026-11-12', effect: 200, notPayment: true },
      ]),
    ).toBe(0);
  });

  it('counts what was paid between the cut-off and the due date', () => {
    const dates = cycleOf('2026-11-07', terms);
    const figures = cycleFigures(dates, {
      today: '2026-11-20',
      currentBalance: -5000,
      movements,
    });
    expect(figures).toMatchObject({
      balanceAtStatement: 7000,
      noInterestPayment: 7000,
      paid: 3000,
      remaining: 4000,
      status: 'due',
      fromStatement: false,
    });
    expect(
      cycleFigures(dates, {
        today: '2026-11-28',
        currentBalance: -5000,
        movements,
      }).status,
    ).toBe('unpaid');
    expect(
      cycleFigures(dates, {
        today: '2026-11-28',
        currentBalance: -1000,
        movements: [...movements, { day: '2026-11-25', effect: 4000 }],
      }),
    ).toMatchObject({ remaining: 0, status: 'paid' });
    // The cycle is still running.
    expect(
      cycleFigures(cycleOf('2026-12-07', terms), {
        today: '2026-11-20',
        currentBalance: -5000,
        movements,
      }).status,
    ).toBe('open');
  });

  it('adds the installments of the cycle not on the card yet', () => {
    const figures = cycleFigures(cycleOf('2026-11-07', terms), {
      today: '2026-11-20',
      currentBalance: -5000,
      movements,
      pendingInstallments: 250,
    });
    expect(figures.noInterestPayment).toBe(7250);
    expect(figures.remaining).toBe(4250);
  });

  it('leaves out the installments after the cut-off of whole purchases in the balance', () => {
    // Owed 7,000 at the cut-off: 6,000 is a 6-month purchase whose first
    // installment (1,000) is billed this cycle; 5,000 is billed later.
    const figures = cycleFigures(cycleOf('2026-11-07', terms), {
      today: '2026-11-20',
      currentBalance: -5000,
      movements,
      deferredInstallments: 5000,
      installmentsInCycle: 1000,
      installmentBalance: 5000,
    });
    expect(figures).toMatchObject({
      balanceAtStatement: 7000,
      noInterestPayment: 2000,
      installmentsInCycle: 1000,
      installmentBalance: 5000,
      cashBalance: 1000,
      remaining: 0,
      status: 'paid',
    });
  });

  it("uses the statement's figures when one was imported", () => {
    const figures = cycleFigures(cycleOf('2026-11-07', terms), {
      today: '2026-11-20',
      currentBalance: -5000,
      movements,
      statement: {
        statementDate: '2026-11-07',
        periodStart: '2026-10-08',
        paymentDueDate: '2026-11-26',
        statementBalance: 9000,
        noInterestPayment: 6500,
        minimumPayment: 400,
      },
    });
    expect(figures).toMatchObject({
      paymentDueDate: '2026-11-26',
      balanceAtStatement: 9000,
      noInterestPayment: 6500,
      minimumPayment: 400,
      remaining: 3500,
      fromStatement: true,
    });
  });

  it('estimates interest with VAT, only with a rate', () => {
    // 1,000 × (36% / 360) × 30 days × 1.16
    expect(interestEstimate(1000, 36, '2026-11-27', '2026-12-27')).toBe(34.8);
    expect(interestEstimate(1000, null, '2026-11-27', '2026-12-27')).toBeNull();
    expect(interestEstimate(0, 36, '2026-11-27', '2026-12-27')).toBeNull();
  });

  it('reminds after the cut-off, before and on the due date, and the day after', () => {
    const figures = cycleFigures(cycleOf('2026-11-07', terms), {
      today: '2026-11-08',
      currentBalance: -5000,
      movements,
    });
    expect(remindersOn('2026-11-08', figures)).toEqual(['statement']);
    expect(remindersOn('2026-11-24', figures)).toEqual(['due_soon']);
    expect(remindersOn('2026-11-27', figures)).toEqual(['due_today']);
    expect(remindersOn('2026-11-28', figures)).toEqual(['unpaid']);
    expect(remindersOn('2026-11-20', figures)).toEqual([]);
    expect(remindersOn('2026-11-27', { ...figures, remaining: 0 })).toEqual([]);
  });
});
