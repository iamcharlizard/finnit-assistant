import { RecurringFrequency } from '@finnit/database';
import {
  dueDatesBetween,
  monthlyEquivalent,
  nextDueDate,
  toDateOnly,
} from './schedule.util';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const iso = (dates: Date[]) => dates.map((x) => x.toISOString().slice(0, 10));

describe('schedule.util', () => {
  describe('dueDatesBetween', () => {
    it('generates weekly dates', () => {
      const rule = {
        frequency: RecurringFrequency.weekly,
        interval: 1,
        startDate: d('2026-01-05'),
      };
      expect(
        iso(dueDatesBetween(rule, d('2026-01-01'), d('2026-01-31'))),
      ).toEqual(['2026-01-05', '2026-01-12', '2026-01-19', '2026-01-26']);
    });

    it('generates biweekly dates every 14 days', () => {
      const rule = {
        frequency: RecurringFrequency.biweekly,
        interval: 1,
        startDate: d('2026-01-02'),
      };
      expect(
        iso(dueDatesBetween(rule, d('2026-01-01'), d('2026-02-28'))),
      ).toEqual([
        '2026-01-02',
        '2026-01-16',
        '2026-01-30',
        '2026-02-13',
        '2026-02-27',
      ]);
    });

    it('generates semimonthly dates on the 15th and the last day of the month', () => {
      const rule = {
        frequency: RecurringFrequency.semimonthly,
        interval: 1,
        startDate: d('2026-01-20'),
      };
      expect(
        iso(dueDatesBetween(rule, d('2026-01-01'), d('2026-03-15'))),
      ).toEqual(['2026-01-31', '2026-02-15', '2026-02-28', '2026-03-15']);
    });

    it('clamps monthly dates to the end of shorter months and keeps the anchor day', () => {
      const rule = {
        frequency: RecurringFrequency.monthly,
        interval: 1,
        startDate: d('2026-01-31'),
      };
      expect(
        iso(dueDatesBetween(rule, d('2026-01-01'), d('2026-04-30'))),
      ).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
    });

    it('handles leap years for yearly rules', () => {
      const rule = {
        frequency: RecurringFrequency.yearly,
        interval: 1,
        startDate: d('2024-02-29'),
      };
      expect(
        iso(dueDatesBetween(rule, d('2024-01-01'), d('2028-12-31'))),
      ).toEqual([
        '2024-02-29',
        '2025-02-28',
        '2026-02-28',
        '2027-02-28',
        '2028-02-29',
      ]);
    });

    it.each([
      [
        RecurringFrequency.bimonthly,
        ['2026-01-10', '2026-03-10', '2026-05-10'],
      ],
      [RecurringFrequency.quarterly, ['2026-01-10', '2026-04-10']],
      [RecurringFrequency.semiannual, ['2026-01-10']],
    ])('generates %s dates', (frequency, expected) => {
      const rule = { frequency, interval: 1, startDate: d('2026-01-10') };
      expect(
        iso(dueDatesBetween(rule, d('2026-01-01'), d('2026-06-30'))),
      ).toEqual(expected);
    });

    it('applies the interval', () => {
      const rule = {
        frequency: RecurringFrequency.monthly,
        interval: 3,
        startDate: d('2026-01-10'),
      };
      expect(
        iso(dueDatesBetween(rule, d('2026-01-01'), d('2026-12-31'))),
      ).toEqual(['2026-01-10', '2026-04-10', '2026-07-10', '2026-10-10']);
    });

    it('stops at the end date', () => {
      const rule = {
        frequency: RecurringFrequency.monthly,
        interval: 1,
        startDate: d('2026-01-10'),
        endDate: d('2026-03-10'),
      };
      expect(
        iso(dueDatesBetween(rule, d('2026-01-01'), d('2026-12-31'))),
      ).toEqual(['2026-01-10', '2026-02-10', '2026-03-10']);
    });

    it('returns nothing before the start date', () => {
      const rule = {
        frequency: RecurringFrequency.monthly,
        interval: 1,
        startDate: d('2026-06-01'),
      };
      expect(dueDatesBetween(rule, d('2026-01-01'), d('2026-05-31'))).toEqual(
        [],
      );
    });
  });

  describe('nextDueDate', () => {
    const rule = {
      frequency: RecurringFrequency.monthly,
      interval: 1,
      startDate: d('2026-01-15'),
    };

    it('returns the same day when it is due', () => {
      expect(
        nextDueDate(rule, d('2026-03-15'))?.toISOString().slice(0, 10),
      ).toBe('2026-03-15');
    });

    it('returns the following due date', () => {
      expect(
        nextDueDate(rule, d('2026-03-16'))?.toISOString().slice(0, 10),
      ).toBe('2026-04-15');
    });

    it('returns null when the rule has ended', () => {
      expect(
        nextDueDate({ ...rule, endDate: d('2026-02-15') }, d('2026-03-01')),
      ).toBeNull();
    });
  });

  describe('monthlyEquivalent', () => {
    it.each([
      [RecurringFrequency.weekly, 1, 433.33],
      [RecurringFrequency.biweekly, 1, 216.67],
      [RecurringFrequency.semimonthly, 1, 200],
      [RecurringFrequency.monthly, 1, 100],
      [RecurringFrequency.monthly, 2, 50],
      [RecurringFrequency.quarterly, 1, 33.33],
      [RecurringFrequency.yearly, 1, 8.33],
    ])(
      '%s every %i of 100 costs %d per month',
      (frequency, interval, expected) => {
        expect(monthlyEquivalent(100, frequency, interval)).toBe(expected);
      },
    );
  });

  it('toDateOnly drops the time of day in UTC', () => {
    expect(toDateOnly(new Date('2026-05-10T23:59:00.000Z')).toISOString()).toBe(
      '2026-05-10T00:00:00.000Z',
    );
  });
});
