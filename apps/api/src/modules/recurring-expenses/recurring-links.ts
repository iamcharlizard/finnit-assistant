/**
 * Linking an expense to the recurring payment it paid (a subscription, a
 * membership, a service…). Every recurring expense (not loans: they have
 * their own flow) can be picked; for the month chosen (the expense's by
 * default) its payment is the scheduled one, or a new one on its usual day
 * when none was generated (e.g. the expense started before the date it was
 * registered with). The ones due near the expense's day with a similar
 * amount (the bank sync's rules) come first, the closest proposed.
 */
import { OccurrenceStatus } from '@finnit/database';

import {
  OCCURRENCE_DATE_WINDOW_DAYS,
  fitsRecurringAmount,
  identifiesRecurring,
} from '../statements/reconciliation/matching';
import { normalizeText } from '../statements/parsing/parse-utils';

export type DayKey = string;
/** "2026-10" */
export type MonthKey = string;

/** Months the dialog lets the user choose, around the expense's. */
export const MONTHS_BEFORE = 3;
export const MONTHS_AFTER = 2;

export type SlotStatus =
  | 'pending'
  | 'missed'
  /** Marked paid by hand, without a movement: it takes this one. */
  | 'paid_without_movement'
  /** Already paid with another movement: it can't take this one. */
  | 'linked'
  /** Not generated (before the start date, or off schedule): created on linking. */
  | 'unscheduled';

export interface LinkSlot {
  month: MonthKey;
  dueDay: DayKey;
  status: SlotStatus;
  occurrenceId: string | null;
  expectedAmount: number;
}

export interface SlotOccurrence {
  id: string;
  dueDay: DayKey;
  status: OccurrenceStatus;
  hasMovement: boolean;
  expectedAmount: number;
}

const DAY_MS = 86_400_000;
const parse = (day: DayKey) => Date.parse(`${day}T00:00:00Z`);
export const dayDiff = (a: DayKey, b: DayKey) =>
  Math.abs(parse(a) - parse(b)) / DAY_MS;

export const monthOfDay = (day: DayKey): MonthKey => day.slice(0, 7);

export function shiftMonth(month: MonthKey, by: number): MonthKey {
  const [y, m] = month.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1 + by, 1));
  return date.toISOString().slice(0, 7);
}

export function monthsAround(month: MonthKey): MonthKey[] {
  const months: MonthKey[] = [];
  for (let i = -MONTHS_BEFORE; i <= MONTHS_AFTER; i++) {
    months.push(shiftMonth(month, i));
  }
  return months;
}

/** First and last day of a month. */
export function monthRange(month: MonthKey): { from: DayKey; to: DayKey } {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(last).padStart(2, '0')}`,
  };
}

/** The expense's day of the month in another month (clamped). */
export function sameDayIn(month: MonthKey, day: DayKey): DayKey {
  const { to } = monthRange(month);
  const wanted = Number(day.slice(8, 10));
  const last = Number(to.slice(8, 10));
  return `${month}-${String(Math.min(wanted, last)).padStart(2, '0')}`;
}

/**
 * A recurring expense's payment in a month: the generated one closest to
 * the expense's day that can still take a movement (pending, missed, paid
 * without one), else the one already paid with another, else a new one on
 * the schedule's day (or the expense's day when the schedule has none).
 */
export function slotFor(
  month: MonthKey,
  occurrences: ReadonlyArray<SlotOccurrence>,
  rhythmDays: ReadonlyArray<DayKey>,
  expenseDay: DayKey,
  amount: number,
): LinkSlot {
  const target = sameDayIn(month, expenseDay);
  const inMonth = occurrences.filter((o) => monthOfDay(o.dueDay) === month);
  const closest = <T extends { dueDay: DayKey }>(list: T[]) =>
    [...list].sort(
      (a, b) => dayDiff(a.dueDay, target) - dayDiff(b.dueDay, target),
    )[0];

  const open = closest(
    inMonth.filter(
      (o) => !o.hasMovement && o.status !== OccurrenceStatus.skipped,
    ),
  );
  if (open) {
    return {
      month,
      dueDay: open.dueDay,
      occurrenceId: open.id,
      expectedAmount: open.expectedAmount,
      status:
        open.status === OccurrenceStatus.paid
          ? 'paid_without_movement'
          : open.status === OccurrenceStatus.missed
            ? 'missed'
            : 'pending',
    };
  }
  const taken = closest(inMonth.filter((o) => o.hasMovement));
  if (taken) {
    return {
      month,
      dueDay: taken.dueDay,
      occurrenceId: taken.id,
      expectedAmount: taken.expectedAmount,
      status: 'linked',
    };
  }
  const generated = new Set(inMonth.map((o) => o.dueDay));
  const free = rhythmDays.filter(
    (d) => monthOfDay(d) === month && !generated.has(d),
  );
  return {
    month,
    dueDay:
      [...free].sort((a, b) => dayDiff(a, target) - dayDiff(b, target))[0] ??
      target,
    occurrenceId: null,
    expectedAmount: amount,
    status: 'unscheduled',
  };
}

/**
 * How well a payment fits the expense (lower is better), or null when it
 * doesn't: due within the bank sync's 10 days, with a similar amount.
 */
export function fitScore(
  slot: Pick<LinkSlot, 'dueDay' | 'expectedAmount' | 'status'>,
  movement: { day: DayKey; amount: number },
  isVariableAmount: boolean,
): number | null {
  if (slot.status === 'linked') return null;
  const days = dayDiff(slot.dueDay, movement.day);
  if (days > OCCURRENCE_DATE_WINDOW_DAYS) return null;
  if (
    !fitsRecurringAmount(movement.amount, slot.expectedAmount, isVariableAmount)
  ) {
    return null;
  }
  const share =
    Math.abs(slot.expectedAmount - movement.amount) /
    Math.max(slot.expectedAmount, 0.01);
  return days / OCCURRENCE_DATE_WINDOW_DAYS + share / 0.15;
}

/** The expense's pattern (or name) appears in the movement's text. */
export function namesMatch(
  movementText: string,
  expense: { name: string; merchantPattern: string | null },
): boolean {
  return identifiesRecurring(normalizeText(movementText), {
    merchantPattern: expense.merchantPattern,
    expenseName: expense.name,
  });
}

export interface RankedExpense {
  id: string;
  amount: number;
  nameMatches: boolean;
  /** Fit of its payment in the expense's month (null: doesn't fit). */
  fit: number | null;
}

/**
 * The ones whose payment fits first (named by the text, then the best fit),
 * then the rest (named first, then the closest amount); the first fitting
 * one is proposed.
 */
export function rankExpenses<T extends RankedExpense>(
  expenses: ReadonlyArray<T>,
  movementAmount: number,
): { ranked: T[]; proposed: string | null } {
  const share = (e: T) =>
    Math.abs(e.amount - movementAmount) / Math.max(e.amount, 0.01);
  const ranked = [...expenses].sort(
    (a, b) =>
      Number(b.fit !== null) - Number(a.fit !== null) ||
      Number(b.nameMatches) - Number(a.nameMatches) ||
      (a.fit ?? 0) - (b.fit ?? 0) ||
      share(a) - share(b),
  );
  const first = ranked[0];
  return { ranked, proposed: first && first.fit !== null ? first.id : null };
}
