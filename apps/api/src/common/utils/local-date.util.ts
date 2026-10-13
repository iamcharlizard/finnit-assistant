/** Time zone used to decide which calendar day a moment belongs to. */
export const DEFAULT_TIME_ZONE = 'America/Mexico_City';

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

/**
 * The calendar day of `date` in `timeZone`, as a Date at midnight UTC (the
 * "date-only" convention used for `txnDate` and every imported date).
 *
 * - A date-only string ("2026-10-13") is that day, whatever the time zone.
 * - A Date at exactly midnight UTC is treated as date-only too: GraphQL's
 *   DateTime scalar turns "2026-10-13" into 2026-10-13T00:00:00Z before the
 *   service sees it, so it is kept as is.
 * - Any other moment (2026-10-14T04:30:00Z) becomes the day it is in
 *   `timeZone` (Oct 13, 22:30 in Mexico City → 2026-10-13).
 */
export function toLocalDateOnly(
  date: Date | string,
  timeZone: string = DEFAULT_TIME_ZONE,
): Date {
  if (typeof date === 'string') {
    const match = DATE_ONLY.exec(date.trim());
    if (match) {
      return new Date(
        Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
      );
    }
  }

  const moment = date instanceof Date ? date : new Date(date);
  const time = moment.getTime();
  if (Number.isNaN(time)) {
    throw new RangeError(`Invalid date: ${String(date)}`);
  }
  if (time % MS_PER_DAY === 0) {
    return new Date(time);
  }
  return calendarDayIn(moment, timeZone);
}

/** Today in `timeZone`, at midnight UTC. */
export function localToday(
  timeZone: string = DEFAULT_TIME_ZONE,
  now: Date = new Date(),
): Date {
  return calendarDayIn(now, timeZone);
}

function calendarDayIn(moment: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(moment);
  const part = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  return new Date(Date.UTC(part('year'), part('month') - 1, part('day')));
}

/** `date` shifted by whole days (date-only arithmetic in UTC). */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}
