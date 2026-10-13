import { accountLabel } from '@/lib/finance/accounts';
import { dayKeyOf, longDate, type DayKey } from '@/lib/finance/dates';
import {
  DEFAULT_CURRENCY,
  formatMoney,
  percentOf,
  roundCents,
} from '@/lib/finance/money';
import type { ApiAccount } from '@/lib/finance/types';
import type { Localizer } from '@/lib/i18n/translator';
import type { ApiDebt, DebtKind } from './types';

/**
 * What the debts screen shows: totals over the debts still owed and one
 * card per debt (paid-off ones last).
 */
export const DEBTS_PATH = '/planning/debts';

export interface DebtTotals {
  /** What is still owed. */
  owed: number;
  /** Sum of the minimum payments of the debts still owed. */
  minimums: number;
  /** Annual rate weighted by balance, over debts with a known rate. */
  weightedRate: number | null;
  /** Debts still owed without a rate (left out of the weighted rate). */
  withoutRate: number;
  active: number;
}

/**
 * Totals over the debts still owed. Computed here rather than read from
 * debtSummary: the API adds up minimums of paid-off debts too and has no
 * weighted rate.
 */
export function summarizeDebts(debts: ReadonlyArray<ApiDebt>): DebtTotals {
  const active = debts.filter((d) => d.remainingBalance > 0);
  const rated = active.filter((d) => d.interestRateAnnual != null);
  const ratedBalance = rated.reduce((s, d) => s + d.remainingBalance, 0);
  return {
    owed: roundCents(active.reduce((s, d) => s + d.remainingBalance, 0)),
    minimums: roundCents(
      active.reduce((s, d) => s + (d.minPaymentAmount ?? 0), 0),
    ),
    weightedRate:
      ratedBalance > 0
        ? Math.round(
            (rated.reduce(
              (s, d) => s + d.remainingBalance * d.interestRateAnnual!,
              0,
            ) /
              ratedBalance) *
              100,
          ) / 100
        : null,
    withoutRate: active.length - rated.length,
    active: active.length,
  };
}

/** "24.5%" (up to two decimals). */
export function formatRate(rate: number): string {
  return `${Math.round(rate * 100) / 100}%`;
}

export interface DebtItem {
  id: string;
  debt: ApiDebt;
  name: string;
  kind: DebtKind;
  remaining: string;
  principal: string;
  paid: string;
  paidPercent: number;
  rate: string | null;
  minPayment: string | null;
  dueLabel: string | null;
  /** The due date is in the past (and the debt isn't paid off). */
  overdue: boolean;
  /** The linked account's nickname, or null. */
  accountLabel: string | null;
  /** Linked to a credit card account: payments go as transfers to it. */
  linkedToCard: boolean;
  paidOff: boolean;
}

export interface DebtsView {
  today: DayKey;
  currency: string;
  totals: {
    owed: string;
    minimums: string;
    weightedRate: string | null;
    withoutRate: number;
    active: number;
    paidOff: number;
  };
  debts: DebtItem[];
  accounts: ApiAccount[];
  /** Debts still owed, for the payoff plan. */
  activeIds: string[];
}

export function buildDebtsView(
  { debts, accounts }: { debts: ApiDebt[]; accounts: ApiAccount[] },
  { today }: { today: DayKey },
  { locale }: Localizer,
): DebtsView {
  const currency = DEFAULT_CURRENCY;
  const money = (n: number) => formatMoney(n, currency, locale);
  const totals = summarizeDebts(debts);
  const byId = new Map(accounts.map((a) => [a.id, a]));

  const items = debts.map((debt): DebtItem => {
    const account = debt.linkedAccountId
      ? byId.get(debt.linkedAccountId)
      : undefined;
    const paidOff = debt.remainingBalance <= 0;
    const due = debt.dueDate ? dayKeyOf(debt.dueDate) : null;
    return {
      id: debt.id,
      debt,
      name: debt.name,
      kind: debt.kind,
      remaining: money(debt.remainingBalance),
      principal: money(debt.principal),
      paid: money(debt.totalPaid),
      paidPercent: Math.min(100, percentOf(debt.totalPaid, debt.principal)),
      rate:
        debt.interestRateAnnual != null
          ? formatRate(debt.interestRateAnnual)
          : null,
      minPayment:
        debt.minPaymentAmount != null ? money(debt.minPaymentAmount) : null,
      dueLabel: due ? longDate(due, today, locale) : null,
      overdue: !paidOff && due !== null && due < today,
      accountLabel: account ? accountLabel(account) : null,
      linkedToCard: account?.type === 'credit',
      paidOff,
    };
  });

  // Still owed first, the biggest balance first; then the paid-off ones.
  const ordered = [
    ...items
      .filter((d) => !d.paidOff)
      .sort((a, b) => b.debt.remainingBalance - a.debt.remainingBalance),
    ...items.filter((d) => d.paidOff),
  ];

  return {
    today,
    currency,
    totals: {
      owed: money(totals.owed),
      minimums: money(totals.minimums),
      weightedRate:
        totals.weightedRate != null ? formatRate(totals.weightedRate) : null,
      withoutRate: totals.withoutRate,
      active: totals.active,
      paidOff: debts.length - totals.active,
    },
    debts: ordered,
    accounts,
    activeIds: ordered.filter((d) => !d.paidOff).map((d) => d.id),
  };
}
