import {
  addDayKeys,
  combineBalances,
  mainCurrency,
  dailyBalances,
  daysInRange,
  firstCompleteDay,
  type DayMovements,
} from './balance-history';

const moves = (entries: [string, number[]][]) =>
  new Map<string, DayMovements>(
    entries.map(([day, effects]) => [
      day,
      {
        inflow: effects.filter((e) => e > 0).reduce((a, b) => a + b, 0),
        outflow: effects.filter((e) => e < 0).reduce((a, b) => a + b, 0),
        count: effects.length,
      },
    ]),
  );

describe('daily balances', () => {
  it('walks back from the current balance, newest day first', () => {
    // Started the 1st with 1,000; bought 200 on the 2nd; paid 50 the 3rd.
    const days = dailyBalances({
      current: 750,
      byDay: moves([
        ['2026-11-02', [-200]],
        ['2026-11-03', [-50]],
      ]),
      from: '2026-11-01',
      to: '2026-11-03',
      completeFrom: '2026-11-01',
    });
    expect(
      days.map((d) => [d.date, d.openingBalance, d.closingBalance]),
    ).toEqual([
      ['2026-11-03', 800, 750],
      ['2026-11-02', 1000, 800],
      ['2026-11-01', 1000, 1000],
    ]);
    expect(days[1]).toMatchObject({ inflow: 0, outflow: 200, movements: 1 });
  });

  it('takes off what happened after the range (and future-dated movements)', () => {
    const days = dailyBalances({
      current: 500,
      byDay: moves([
        ['2026-11-02', [300, -100]],
        ['2026-11-05', [-100]],
        ['2026-12-01', [-50]],
      ]),
      from: '2026-11-02',
      to: '2026-11-02',
      completeFrom: '2026-11-02',
    });
    expect(days).toEqual([
      {
        date: '2026-11-02',
        openingBalance: 450,
        closingBalance: 650,
        inflow: 300,
        outflow: 100,
        movements: 2,
        complete: true,
      },
    ]);
  });

  it('a payment registered later with an earlier date only moves the days from its date', () => {
    const before = dailyBalances({
      current: 800,
      byDay: moves([['2026-11-02', [-200]]]),
      from: '2026-10-31',
      to: '2026-11-03',
      completeFrom: '2026-10-01',
    });
    // Registering a 100 expense dated the 1st lowers today's balance too.
    const after = dailyBalances({
      current: 700,
      byDay: moves([
        ['2026-11-01', [-100]],
        ['2026-11-02', [-200]],
      ]),
      from: '2026-10-31',
      to: '2026-11-03',
      completeFrom: '2026-10-01',
    });
    const closing = (rows: typeof before) => rows.map((d) => d.closingBalance);
    expect(closing(before)).toEqual([800, 800, 1000, 1000]);
    expect(closing(after)).toEqual([700, 700, 900, 1000]);
  });

  it('marks the days before the trusted start as incomplete', () => {
    const days = dailyBalances({
      current: 0,
      byDay: new Map(),
      from: '2026-11-01',
      to: '2026-11-02',
      completeFrom: '2026-11-02',
    });
    expect(days.map((d) => d.complete)).toEqual([true, false]);
    expect(
      dailyBalances({
        current: 0,
        byDay: new Map(),
        from: '2026-11-01',
        to: '2026-11-01',
        completeFrom: null,
      })[0]?.complete,
    ).toBe(false);
  });
});

describe('first complete day', () => {
  it('starts when the account was added, or at the oldest bank movement', () => {
    expect(
      firstCompleteDay({
        createdOn: '2026-10-13',
        oldestImported: null,
        lastUnknownEffect: null,
      }),
    ).toBe('2026-10-13');
    expect(
      firstCompleteDay({
        createdOn: '2026-10-13',
        oldestImported: '2026-07-15',
        lastUnknownEffect: null,
      }),
    ).toBe('2026-07-15');
  });

  it('an account without movements is always complete', () => {
    expect(
      firstCompleteDay({
        hasMovements: false,
        createdOn: '2026-11-03',
        oldestImported: null,
        lastUnknownEffect: null,
      }),
    ).toBe('0001-01-01');
  });

  it('starts after the last movement of unknown direction', () => {
    expect(
      firstCompleteDay({
        createdOn: '2026-10-13',
        oldestImported: null,
        lastUnknownEffect: '2026-10-20',
      }),
    ).toBe('2026-10-21');
  });

  it('counts days in a range', () => {
    expect(daysInRange('2026-11-01', '2026-11-03')).toBe(3);
    expect(daysInRange('2026-11-03', '2026-11-01')).toBe(0);
    expect(addDayKeys('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('all accounts together', () => {
  const day = (
    date: string,
    opening: number,
    closing: number,
    movements = 0,
    complete = true,
  ) => ({
    date,
    openingBalance: opening,
    closingBalance: closing,
    inflow: 0,
    outflow: 0,
    movements,
    complete,
  });

  it('adds money available and card debt separately', () => {
    const days = combineBalances(
      [
        {
          isCredit: false,
          days: [day('2026-11-03', 1000, 800, 1), day('2026-11-02', 900, 1000)],
        },
        {
          isCredit: false,
          days: [day('2026-11-03', 50, 50), day('2026-11-02', 50, 50)],
        },
        {
          isCredit: true,
          days: [
            day('2026-11-03', -300, -500, 2),
            day('2026-11-02', -300, -300, 0, false),
          ],
        },
      ],
      ['2026-11-03', '2026-11-02'],
    );
    expect(days).toEqual([
      {
        date: '2026-11-03',
        availableOpening: 1050,
        availableClosing: 850,
        debtOpening: 300,
        debtClosing: 500,
        movements: 3,
        complete: true,
      },
      {
        date: '2026-11-02',
        availableOpening: 950,
        availableClosing: 1050,
        debtOpening: 300,
        debtClosing: 300,
        movements: 0,
        complete: false,
      },
    ]);
  });

  it('uses MXN, else the most used currency', () => {
    expect(mainCurrency(['USD', 'MXN', 'USD'])).toBe('MXN');
    expect(mainCurrency(['USD', 'EUR', 'USD'])).toBe('USD');
    expect(mainCurrency(['USD'], 'eur')).toBe('EUR');
    expect(mainCurrency([])).toBeNull();
  });
});
