import {
  addDays,
  daysInMonth,
  monthOf,
  shiftMonth,
  type DayKey,
} from './dates';
import { DEFAULT_CURRENCY, roundCents } from './money';
import type { ApiAccount } from './types';

export interface CurrencyBalance {
  currency: string;
  /** Money in cash, debit, savings and e-wallet accounts. */
  available: number;
  /** What is owed on credit cards (positive). */
  creditDebt: number;
  /** Everything together: available minus what is owed. */
  net: number;
  accounts: number;
}

/** What a credit card account owes: its balance is negative when it owes. */
export function creditOwed(
  account: Pick<ApiAccount, 'balanceCurrent'>,
): number {
  return Math.max(0, roundCents(-account.balanceCurrent));
}

/**
 * Balances per currency, the main currency first (MXN when present,
 * otherwise the one with the most accounts). Archived accounts are left out.
 */
export function summarizeBalances(
  accounts: ReadonlyArray<ApiAccount>,
): CurrencyBalance[] {
  const byCurrency = new Map<string, CurrencyBalance>();
  for (const account of accounts) {
    if (account.archived) continue;
    const total = byCurrency.get(account.currency) ?? {
      currency: account.currency,
      available: 0,
      creditDebt: 0,
      net: 0,
      accounts: 0,
    };
    if (account.type === 'credit') {
      total.creditDebt = roundCents(total.creditDebt + creditOwed(account));
    } else {
      total.available = roundCents(total.available + account.balanceCurrent);
    }
    total.net = roundCents(total.net + account.balanceCurrent);
    total.accounts += 1;
    byCurrency.set(account.currency, total);
  }
  return [...byCurrency.values()].sort(
    (a, b) =>
      Number(b.currency === DEFAULT_CURRENCY) -
        Number(a.currency === DEFAULT_CURRENCY) || b.accounts - a.accounts,
  );
}

/**
 * Next date (today or later) that falls on a day of the month, e.g. a card's
 * cut-off day. Months shorter than the day use their last day.
 */
export function nextMonthlyDay(today: DayKey, dayOfMonth: number): DayKey {
  const current = monthOf(today);
  for (const m of [current, shiftMonth(current, 1)]) {
    const day = Math.min(Math.max(1, Math.round(dayOfMonth)), daysInMonth(m));
    const key = `${m.year}-${String(m.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (key >= today) return key;
  }
  // Unreachable: next month's date is always later than today.
  return addDays(today, 1);
}

/** The date a day of the month falls on in a given month (clamped). */
export function dayInMonth(
  m: { year: number; month: number },
  dayOfMonth: number,
): number {
  return Math.min(Math.max(1, Math.round(dayOfMonth)), daysInMonth(m));
}

export const ACCOUNT_TYPE_LABELS: Record<ApiAccount['type'], string> = {
  cash: 'Efectivo',
  credit: 'Crédito',
  debit: 'Débito',
  ewallet: 'Monedero',
  savings: 'Ahorro',
};
