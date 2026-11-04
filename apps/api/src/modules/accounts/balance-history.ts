/**
 * The balance of an account on each day, worked out backwards from its
 * current balance: the balance at the end of a day is the current balance
 * minus what every confirmed movement dated after that day did to it. A
 * movement registered today with an earlier date therefore changes the days
 * from its date onwards, and nothing before.
 */

/** 'YYYY-MM-DD' (a local calendar day). */
export type DayKey = string;

/** What the movements of one day did to the balance. */
export interface DayMovements {
  /** Sum of the positive effects. */
  inflow: number;
  /** Sum of the negative effects (≤ 0). */
  outflow: number;
  count: number;
}

export interface BalanceDay {
  date: DayKey;
  openingBalance: number;
  closingBalance: number;
  inflow: number;
  /** Money out, as a positive amount. */
  outflow: number;
  movements: number;
  /** False before the first day the history can be trusted. */
  complete: boolean;
}

const cents = (value: number) => Math.round(value * 100) / 100;

export const dayKeyOf = (date: Date): DayKey => date.toISOString().slice(0, 10);

export function addDayKeys(day: DayKey, days: number): DayKey {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return dayKeyOf(date);
}

/** Days from `from` to `to`, both included (0 when `to` is earlier). */
export function daysInRange(from: DayKey, to: DayKey): number {
  const span =
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
    86_400_000;
  return span < 0 ? 0 : Math.round(span) + 1;
}

/**
 * One row per day from `from` to `to`, newest first. `byDay` holds the
 * movements of every day from `from` on, including days after `to` (and
 * future-dated ones), since all of them are already in `current`.
 */
export function dailyBalances({
  current,
  byDay,
  from,
  to,
  completeFrom,
}: {
  current: number;
  byDay: ReadonlyMap<DayKey, DayMovements>;
  from: DayKey;
  to: DayKey;
  /** First trusted day; null = none is (e.g. no data). */
  completeFrom: DayKey | null;
}): BalanceDay[] {
  // What happened after `to` is taken off first.
  let after = 0;
  for (const [day, moves] of byDay) {
    if (day > to) after += moves.inflow + moves.outflow;
  }
  let closing = cents(current - after);

  const days: BalanceDay[] = [];
  for (let day = to; day >= from; day = addDayKeys(day, -1)) {
    const moves = byDay.get(day);
    const net = moves ? moves.inflow + moves.outflow : 0;
    const opening = cents(closing - net);
    days.push({
      date: day,
      openingBalance: opening,
      closingBalance: closing,
      inflow: cents(moves?.inflow ?? 0),
      outflow: cents(-(moves?.outflow ?? 0)),
      movements: moves?.count ?? 0,
      complete: completeFrom !== null && day >= completeFrom,
    });
    closing = opening;
  }
  return days;
}

/** Before any day: every day can be trusted. */
export const ALWAYS_COMPLETE: DayKey = '0001-01-01';

/**
 * The first day whose balance can be trusted: from when the account was
 * added (or, for a bank account, its oldest imported movement), and after
 * the last old adjustment whose direction is unknown. An account without
 * any movement has nothing missing: always zero.
 */
export function firstCompleteDay({
  hasMovements = true,
  createdOn,
  oldestImported,
  lastUnknownEffect,
}: {
  hasMovements?: boolean;
  createdOn: DayKey;
  /** Oldest movement brought by the bank (linked accounts only). */
  oldestImported: DayKey | null;
  /** Date of the latest movement without a recorded effect. */
  lastUnknownEffect: DayKey | null;
}): DayKey {
  if (!hasMovements) return ALWAYS_COMPLETE;
  const start =
    oldestImported && oldestImported < createdOn ? oldestImported : createdOn;
  // That day's own opening already depends on the unknown direction.
  const afterUnknown = lastUnknownEffect
    ? addDayKeys(lastUnknownEffect, 1)
    : null;
  return afterUnknown && afterUnknown > start ? afterUnknown : start;
}

/** All the accounts together on one day: money available and card debt. */
export interface CombinedBalanceDay {
  date: DayKey;
  /** Cash, debit, savings and e-wallets. */
  availableOpening: number;
  availableClosing: number;
  /** What is owed on credit cards (positive). */
  debtOpening: number;
  debtClosing: number;
  movements: number;
  /** False when any account's history isn't trusted that day. */
  complete: boolean;
}

/**
 * Adds up the accounts' days (all for the same range, newest first). A
 * credit card's balance is negative when something is owed; it counts as
 * debt, the rest as money available. Movements between the user's own
 * accounts move both sums, so money in and out are not added up.
 */
export function combineBalances(
  accounts: ReadonlyArray<{ isCredit: boolean; days: BalanceDay[] }>,
  dates: ReadonlyArray<DayKey>,
): CombinedBalanceDay[] {
  return dates.map((date, i) => {
    const day: CombinedBalanceDay = {
      date,
      availableOpening: 0,
      availableClosing: 0,
      debtOpening: 0,
      debtClosing: 0,
      movements: 0,
      complete: true,
    };
    for (const account of accounts) {
      const row = account.days[i];
      if (!row) continue;
      if (account.isCredit) {
        day.debtOpening -= row.openingBalance;
        day.debtClosing -= row.closingBalance;
      } else {
        day.availableOpening += row.openingBalance;
        day.availableClosing += row.closingBalance;
      }
      day.movements += row.movements;
      day.complete &&= row.complete;
    }
    return {
      ...day,
      availableOpening: cents(day.availableOpening),
      availableClosing: cents(day.availableClosing),
      debtOpening: cents(day.debtOpening) || 0,
      debtClosing: cents(day.debtClosing) || 0,
    };
  });
}

/**
 * The currency the combined history is in: the one asked for, else MXN
 * when there is any, else the one most accounts use.
 */
export function mainCurrency(
  currencies: ReadonlyArray<string>,
  requested?: string | null,
): string | null {
  if (requested) return requested.toUpperCase();
  if (currencies.length === 0) return null;
  if (currencies.includes('MXN')) return 'MXN';
  const counts = new Map<string, number>();
  for (const c of currencies) counts.set(c, (counts.get(c) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0][0];
}
