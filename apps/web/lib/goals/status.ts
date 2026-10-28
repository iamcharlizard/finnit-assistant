import { daysBetween, parseDayKey, type DayKey } from '@/lib/finance/dates';
import { roundCents } from '@/lib/finance/money';

/**
 * Where a goal stands:
 * - reached: saved at least the target;
 * - overdue: the due date passed without reaching it;
 * - onTrack: the projection reaches it by the due date;
 * - behind: the projection lands after the due date, or there is none
 *   (nothing saved lately);
 * - noDueDate: no deadline to compare against.
 */
export type GoalStatus =
  | 'reached'
  | 'onTrack'
  | 'behind'
  | 'overdue'
  | 'noDueDate';

export function goalStatus({
  current,
  target,
  dueDay,
  completionDay,
  today,
}: {
  current: number;
  target: number;
  dueDay: DayKey | null;
  /** When the projection reaches the target; null without one. */
  completionDay: DayKey | null;
  today: DayKey;
}): GoalStatus {
  if (current >= target) return 'reached';
  if (!dueDay) return 'noDueDate';
  if (dueDay < today) return 'overdue';
  return completionDay && completionDay <= dueDay ? 'onTrack' : 'behind';
}

/**
 * Whole months from `today` until `due`, counted like the API projects
 * (today plus N months must not pass the due date). 0 when the due date is
 * less than a month away.
 */
export function monthsUntil(today: DayKey, due: DayKey): number {
  const t = parseDayKey(today);
  const d = parseDayKey(due);
  const months = (d.year - t.year) * 12 + (d.month - t.month);
  return Math.max(0, d.day < t.day ? months - 1 : months);
}

/**
 * The monthly saving that reaches the target by the due date (rounded up
 * to cents). With less than a month left it is everything that remains;
 * null when there is no due date or it already passed.
 */
export function neededMonthly({
  remaining,
  dueDay,
  today,
}: {
  remaining: number;
  dueDay: DayKey | null;
  today: DayKey;
}): number | null {
  if (!dueDay || dueDay < today || remaining <= 0) return null;
  const months = monthsUntil(today, dueDay);
  if (months === 0) return roundCents(remaining);
  return Math.ceil(Math.round(remaining * 100) / months) / 100;
}

/** Days from today to the due date (negative once it passed). */
export function daysLeft(dueDay: DayKey, today: DayKey): number {
  return daysBetween(today, dueDay);
}

/** 0–100 for the ring; the label may say more (e.g. 120 %). */
export function progressPercent(current: number, target: number): number {
  if (!(target > 0)) return 0;
  return Math.round((current / target) * 100);
}
