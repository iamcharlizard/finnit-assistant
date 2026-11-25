/**
 * This month so far against the same days of last month, leaving out of
 * last month what hasn't come yet this month: a source that comes every
 * month (the payroll, the rent) and was already in last month's days but
 * not yet in this month's would make the change look bigger than it is
 * (e.g. "-78%" of income only because this fortnight's pay is not in yet).
 *
 * A source is the movement's automatic name (alias) or its merchant /
 * description without digits (bank texts carry references and dates). It
 * "comes every month" when it appeared both last month and the month
 * before.
 */

export type FlowType = 'income' | 'expense';

export interface FlowMovement {
  type: FlowType;
  amount: number;
  /** YYYY-MM-DD. */
  date: string;
  aliasId: string | null;
  merchantName: string | null;
  description: string | null;
}

export interface FlowComparison {
  /** This month, from the 1st to today. */
  now: number;
  /** Last month's same days, without what hasn't come yet this month. */
  before: number;
  /** Monthly sources still to come this month (left out of `before`). */
  pendingSources: number;
}

export interface MonthComparison {
  income: FlowComparison;
  expenses: FlowComparison;
}

/** "SPEI NOMINA 0412 REF 99812" → "spei nomina ref". */
export function sourceKey(movement: FlowMovement): string | null {
  if (movement.aliasId) return `alias:${movement.aliasId}`;
  const text = (movement.merchantName || movement.description || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]+/g, ' ')
    .trim();
  return text ? `text:${text}` : null;
}

const monthKey = (date: string) => date.slice(0, 7);
const dayOf = (date: string) => Number(date.slice(8, 10));

function shiftMonthKey(key: string, by: number): string {
  const [year, month] = key.split('-').map(Number) as [number, number];
  const index = year * 12 + (month - 1) + by;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

function daysIn(key: string): number {
  const [year, month] = key.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * `movements` should cover the month before last up to `today`
 * (YYYY-MM-DD); anything else is ignored.
 */
export function compareMonthToDate(
  movements: readonly FlowMovement[],
  today: string,
): MonthComparison {
  const current = monthKey(today);
  const previous = shiftMonthKey(current, -1);
  const older = shiftMonthKey(current, -2);
  const day = dayOf(today);
  const sameDays = Math.min(day, daysIn(previous));

  const compare = (type: FlowType): FlowComparison => {
    const seen = {
      [current]: new Set<string>(),
      [previous]: new Set<string>(),
      [older]: new Set<string>(),
    };
    let now = 0;
    const before: { key: string | null; amount: number }[] = [];
    for (const m of movements) {
      if (m.type !== type) continue;
      const month = monthKey(m.date);
      const key = sourceKey(m);
      if (month === current && m.date <= today) {
        now += m.amount;
        if (key) seen[current].add(key);
      } else if (month === previous) {
        if (key) seen[previous].add(key);
        if (dayOf(m.date) <= sameDays) before.push({ key, amount: m.amount });
      } else if (month === older && key) {
        seen[older].add(key);
      }
    }
    // Monthly sources seen last month and the month before, not yet this month.
    const pending = new Set(
      [...seen[previous]].filter(
        (key) => seen[older].has(key) && !seen[current].has(key),
      ),
    );
    const kept = before
      .filter((b) => !(b.key && pending.has(b.key)))
      .reduce((sum, b) => sum + b.amount, 0);
    const pendingInWindow = new Set(
      before.filter((b) => b.key && pending.has(b.key)).map((b) => b.key),
    );
    return {
      now: round(now),
      before: round(kept),
      pendingSources: pendingInWindow.size,
    };
  };

  return { income: compare('income'), expenses: compare('expense') };
}
