import {
  compareMonthToDate,
  sourceKey,
  type FlowMovement,
} from './month-comparison';

const move = (
  date: string,
  amount: number,
  name: string,
  type: FlowMovement['type'] = 'income',
): FlowMovement => ({
  type,
  amount,
  date,
  aliasId: null,
  merchantName: name,
  description: null,
});

describe('compareMonthToDate', () => {
  it('leaves out of last month a monthly income that has not come yet', () => {
    const movements = [
      // The payroll every month on the 15th…
      move('2026-09-15', 10000, 'SPEI NOMINA 0915'),
      move('2026-10-15', 10000, 'SPEI NOMINA 1015'),
      // …and a bonus source that also came in September and October.
      move('2026-09-20', 3000, 'Freelance ACME'),
      move('2026-10-20', 3000, 'Freelance ACME'),
      // This month only the payroll so far.
      move('2026-11-15', 10000, 'SPEI NOMINA 1115'),
    ];
    const { income } = compareMonthToDate(movements, '2026-11-24');
    expect(income).toEqual({ now: 10000, before: 10000, pendingSources: 1 });
  });

  it('keeps one-off movements of last month', () => {
    const movements = [
      move('2026-10-03', 500, 'Restaurante', 'expense'),
      move('2026-11-02', 800, 'Super', 'expense'),
    ];
    const { expenses } = compareMonthToDate(movements, '2026-11-24');
    expect(expenses).toEqual({ now: 800, before: 500, pendingSources: 0 });
  });

  it('compares only the same days of last month', () => {
    const movements = [
      move('2026-10-10', 100, 'Uber', 'expense'),
      move('2026-10-28', 900, 'Uber', 'expense'),
      move('2026-11-05', 200, 'Uber', 'expense'),
    ];
    const { expenses } = compareMonthToDate(movements, '2026-11-24');
    expect(expenses.before).toBe(100);
  });

  it('caps the days at the end of a shorter month', () => {
    const movements = [
      move('2027-02-28', 50, 'Cafe', 'expense'),
      move('2027-03-31', 70, 'Cafe', 'expense'),
    ];
    const { expenses } = compareMonthToDate(movements, '2027-03-31');
    expect(expenses).toEqual({ now: 70, before: 50, pendingSources: 0 });
  });

  it('ignores movements after today', () => {
    const movements = [move('2026-11-25', 999, 'Later')];
    expect(compareMonthToDate(movements, '2026-11-24').income.now).toBe(0);
  });
});

describe('sourceKey', () => {
  it('ignores digits, accents and case of bank texts', () => {
    expect(sourceKey(move('2026-11-01', 1, 'SPEI Nómina 0412 REF 99812'))).toBe(
      'text:spei nomina ref',
    );
  });

  it('prefers the automatic name', () => {
    expect(sourceKey({ ...move('2026-11-01', 1, 'x'), aliasId: 'a1' })).toBe(
      'alias:a1',
    );
  });
});
