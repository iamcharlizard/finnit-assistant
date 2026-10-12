import { RecurringFrequency } from '@finnit/database';

export interface ScheduleRule {
  frequency: RecurringFrequency;
  interval: number;
  startDate: Date;
  endDate?: Date | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
// Guards against runaway loops on bad input (e.g. a start date centuries ago).
const MAX_ITERATIONS = 10_000;

const MONTH_STEP: Partial<Record<RecurringFrequency, number>> = {
  [RecurringFrequency.monthly]: 1,
  [RecurringFrequency.bimonthly]: 2,
  [RecurringFrequency.quarterly]: 3,
  [RecurringFrequency.semiannual]: 6,
  [RecurringFrequency.yearly]: 12,
};

// Occurrences per year of each frequency when interval = 1.
const PER_YEAR: Record<RecurringFrequency, number> = {
  [RecurringFrequency.weekly]: 52,
  [RecurringFrequency.biweekly]: 26,
  [RecurringFrequency.semimonthly]: 24,
  [RecurringFrequency.monthly]: 12,
  [RecurringFrequency.bimonthly]: 6,
  [RecurringFrequency.quarterly]: 4,
  [RecurringFrequency.semiannual]: 2,
  [RecurringFrequency.yearly]: 1,
};

/** Midnight UTC of the given date's UTC calendar day (matches Postgres DATE). */
export function toDateOnly(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/** Adds months keeping the anchor day, clamped to the month's last day (Jan 31 → Feb 28). */
function addMonthsClamped(start: Date, months: number): Date {
  const total = start.getUTCMonth() + months;
  const year = start.getUTCFullYear() + Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  const day = Math.min(start.getUTCDate(), lastDayOfMonth(year, month));
  return new Date(Date.UTC(year, month, day));
}

/** The 15th and the last day of each month, from the start date's month on. */
function* semimonthlyDates(start: Date): Generator<Date> {
  let year = start.getUTCFullYear();
  let month = start.getUTCMonth();
  for (;;) {
    yield new Date(Date.UTC(year, month, 15));
    yield new Date(Date.UTC(year, month, lastDayOfMonth(year, month)));
    month += 1;
    if (month === 12) {
      month = 0;
      year += 1;
    }
  }
}

function* allDueDates(rule: ScheduleRule): Generator<Date> {
  const start = toDateOnly(rule.startDate);
  const interval = Math.max(1, rule.interval);

  if (rule.frequency === RecurringFrequency.semimonthly) {
    let index = 0;
    for (const date of semimonthlyDates(start)) {
      if (date < start) continue;
      if (index % interval === 0) yield date;
      index += 1;
    }
    return;
  }

  const monthStep = MONTH_STEP[rule.frequency];
  for (let k = 0; ; k += 1) {
    if (monthStep) {
      yield addMonthsClamped(start, monthStep * interval * k);
    } else {
      const days = rule.frequency === RecurringFrequency.weekly ? 7 : 14;
      yield addDays(start, days * interval * k);
    }
  }
}

/** Due dates of the rule within [from, to] (inclusive, date-only, ascending). */
export function dueDatesBetween(
  rule: ScheduleRule,
  from: Date,
  to: Date,
): Date[] {
  const start = toDateOnly(from);
  const end = toDateOnly(to);
  const ruleEnd = rule.endDate ? toDateOnly(rule.endDate) : undefined;
  const dates: Date[] = [];

  let iterations = 0;
  for (const date of allDueDates(rule)) {
    if (date > end || (ruleEnd && date > ruleEnd)) break;
    if (++iterations > MAX_ITERATIONS) break;
    if (date >= start) dates.push(date);
  }
  return dates;
}

/** First due date on or after `from`, or null when the rule has ended. */
export function nextDueDate(rule: ScheduleRule, from: Date): Date | null {
  const start = toDateOnly(from);
  const ruleEnd = rule.endDate ? toDateOnly(rule.endDate) : undefined;

  let iterations = 0;
  for (const date of allDueDates(rule)) {
    if (ruleEnd && date > ruleEnd) return null;
    if (++iterations > MAX_ITERATIONS) return null;
    if (date >= start) return date;
  }
  return null;
}

/** Average monthly cost of one occurrence amount under the rule. */
export function monthlyEquivalent(
  amount: number,
  frequency: RecurringFrequency,
  interval: number,
): number {
  const perMonth = PER_YEAR[frequency] / 12 / Math.max(1, interval);
  return Math.round(amount * perMonth * 100) / 100;
}
