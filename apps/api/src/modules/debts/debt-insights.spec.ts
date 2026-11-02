import {
  lastMonths,
  nextMonths,
  paidByMonth,
  projectBalances,
  upcomingTotals,
} from './debt-insights';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const today = d('2026-10-30');

describe('debt-insights', () => {
  it('lists past and coming months across years', () => {
    expect(lastMonths(today, 3)).toEqual(['2026-08', '2026-09', '2026-10']);
    expect(nextMonths(d('2026-11-15'), 3)).toEqual([
      '2026-12',
      '2027-01',
      '2027-02',
    ]);
  });

  it('adds payments per month and bucket, dropping the ones outside', () => {
    expect(
      paidByMonth(
        ['2026-09', '2026-10'],
        [
          { date: d('2026-09-05'), amount: 100, bucket: 'historical' },
          { date: d('2026-10-05'), amount: 100, bucket: 'counted' },
          { date: d('2026-10-20'), amount: 50.5, bucket: 'counted' },
          { date: d('2026-10-21'), amount: 30, bucket: 'msi' },
          { date: d('2025-01-01'), amount: 999, bucket: 'counted' },
        ],
      ),
    ).toEqual([
      { month: '2026-09', counted: 0, historical: 100, msi: 0 },
      { month: '2026-10', counted: 150.5, historical: 0, msi: 30 },
    ]);
  });

  it('projects scheduled debts by their payments and others by rate and minimum', () => {
    const rows = projectBalances(today, 3, [
      {
        isMsi: false,
        remaining: 3_000,
        schedule: [
          // Overdue: falls in the first month.
          { dueDate: d('2026-10-15'), amount: 1_000 },
          { dueDate: d('2026-11-15'), amount: 1_000 },
          { dueDate: d('2026-12-15'), amount: 1_000 },
        ],
        monthly: 1_000,
        monthlyRate: 0,
      },
      {
        isMsi: false,
        remaining: 1_000,
        schedule: null,
        monthly: 510,
        monthlyRate: 0.02,
      },
      {
        isMsi: true,
        remaining: 600,
        schedule: null,
        monthly: 300,
        monthlyRate: 0,
      },
    ]);
    expect(rows).toEqual([
      { month: '2026-11', debt: 1_000 + 510, msi: 300 },
      { month: '2026-12', debt: 0 + 10.2, msi: 0 },
      { month: '2027-01', debt: 0, msi: 0 },
    ]);
  });

  it('adds what is due within 30, 60 and 90 days', () => {
    expect(
      upcomingTotals(today, [
        {
          isMsi: false,
          remaining: 3_000,
          schedule: [
            { dueDate: d('2026-10-15'), amount: 1_000 },
            { dueDate: d('2026-11-15'), amount: 1_000 },
            { dueDate: d('2027-01-15'), amount: 1_000 },
          ],
          monthly: 1_000,
          monthlyRate: 0,
        },
        {
          isMsi: false,
          remaining: 500,
          schedule: null,
          monthly: 300,
          monthlyRate: 0,
        },
      ]),
    ).toEqual({ days30: 2_300, days60: 2_500, days90: 3_500 });
  });
});
