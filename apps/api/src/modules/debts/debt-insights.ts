/**
 * Aggregations behind the debts charts: what is owed by type, what was paid
 * each month (historical payments included, counted apart), the balance
 * projected month by month and what is due soon. Pure; the service loads
 * the rows.
 */

/** Chart categories: loan types, cards, other debts and card MSI plans. */
export type DebtCategory =
  | 'institutional'
  | 'personal'
  | 'purchase_financing'
  | 'card'
  | 'other'
  | 'msi';

export type PaymentBucket = 'counted' | 'historical' | 'msi';

export interface DueItem {
  dueDate: Date;
  amount: number;
}

/** One debt (or MSI plan) as the projection sees it. */
export interface DebtStream {
  isMsi: boolean;
  remaining: number;
  /**
   * Scheduled payments still to make (overdue ones included). Interest is
   * already inside them. Null: pays `monthly` and accrues `monthlyRate`.
   */
  schedule: DueItem[] | null;
  monthly: number;
  /** Monthly rate as a fraction (unscheduled debts only). */
  monthlyRate: number;
}

const cents = (n: number) => Math.round(n * 100) / 100;
const DAY_MS = 86_400_000;

/** "2026-10" of a date-only value. */
export function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

/** The `count` month keys ending with `today`'s month, oldest first. */
export function lastMonths(today: Date, count: number): string[] {
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1),
    );
    keys.push(monthKey(d));
  }
  return keys;
}

/** The `count` month keys after `today`'s month. */
export function nextMonths(today: Date, count: number): string[] {
  const keys: string[] = [];
  for (let i = 1; i <= count; i += 1) {
    keys.push(
      monthKey(
        new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + i, 1)),
      ),
    );
  }
  return keys;
}

export interface PaidMonth {
  month: string;
  counted: number;
  historical: number;
  msi: number;
}

/** Payments per month and bucket over the given months (others dropped). */
export function paidByMonth(
  months: string[],
  payments: { date: Date; amount: number; bucket: PaymentBucket }[],
): PaidMonth[] {
  const rows = new Map(
    months.map((month) => [
      month,
      { month, counted: 0, historical: 0, msi: 0 },
    ]),
  );
  for (const payment of payments) {
    const row = rows.get(monthKey(payment.date));
    if (row) row[payment.bucket] += payment.amount;
  }
  return [...rows.values()].map((r) => ({
    month: r.month,
    counted: cents(r.counted),
    historical: cents(r.historical),
    msi: cents(r.msi),
  }));
}

export interface ProjectedMonth {
  month: string;
  /** Loans, cards and other debts owed at the end of the month. */
  debt: number;
  msi: number;
}

/**
 * Balance at the end of each coming month. Scheduled debts go down by their
 * payments of that month (overdue ones fall in the first month); the rest
 * accrue their rate and pay their monthly amount.
 */
export function projectBalances(
  today: Date,
  horizon: number,
  streams: DebtStream[],
): ProjectedMonth[] {
  const months = nextMonths(today, horizon);
  const first = months[0];
  const rows = months.map((month) => ({ month, debt: 0, msi: 0 }));

  for (const stream of streams) {
    let balance = stream.remaining;
    const due = new Map<string, number>();
    for (const item of stream.schedule ?? []) {
      // Due this month or overdue: paid in the first projected month.
      const key =
        monthKey(item.dueDate) <= monthKey(today)
          ? first
          : monthKey(item.dueDate);
      due.set(key, (due.get(key) ?? 0) + item.amount);
    }
    rows.forEach((row) => {
      if (balance > 0) {
        if (stream.schedule) {
          balance -= due.get(row.month) ?? 0;
        } else {
          balance = balance * (1 + stream.monthlyRate) - stream.monthly;
        }
        balance = Math.max(0, balance);
      }
      row[stream.isMsi ? 'msi' : 'debt'] += balance;
    });
  }
  return rows.map((r) => ({
    month: r.month,
    debt: cents(r.debt),
    msi: cents(r.msi),
  }));
}

export interface UpcomingTotals {
  days30: number;
  days60: number;
  days90: number;
}

/**
 * What is due within 30, 60 and 90 days (overdue included): scheduled
 * payments by date, and one monthly payment per 30 days for the rest.
 */
export function upcomingTotals(
  today: Date,
  streams: DebtStream[],
): UpcomingTotals {
  const totals = { days30: 0, days60: 0, days90: 0 };
  for (const stream of streams) {
    if (stream.remaining <= 0) continue;
    if (stream.schedule) {
      for (const item of stream.schedule) {
        const days = (item.dueDate.getTime() - today.getTime()) / DAY_MS;
        if (days <= 30) totals.days30 += item.amount;
        if (days <= 60) totals.days60 += item.amount;
        if (days <= 90) totals.days90 += item.amount;
      }
    } else {
      // Never more than what is owed.
      totals.days30 += Math.min(stream.monthly, stream.remaining);
      totals.days60 += Math.min(stream.monthly * 2, stream.remaining);
      totals.days90 += Math.min(stream.monthly * 3, stream.remaining);
    }
  }
  return {
    days30: cents(totals.days30),
    days60: cents(totals.days60),
    days90: cents(totals.days90),
  };
}
