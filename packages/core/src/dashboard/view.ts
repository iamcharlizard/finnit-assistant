import type { Localizer } from '../i18n/translator';
import type { ApiAllBalanceHistory } from '../accounts/all-balance';
import {
  accountLabel,
  countsInTotal,
  summarizeBalances,
} from '../finance/accounts';
import {
  addDays,
  daysInMonth,
  firstDayOf,
  monthLabel,
  monthOf,
  shiftMonth,
  weekdayDate,
  type DayKey,
  type MonthRef,
} from '../finance/dates';
import { formatMoney } from '../finance/money';
import { MASKED_AMOUNT } from '../finance/mask';
import { toPaymentRow, type PaymentRow } from '../finance/payments';
import type { ApiDebtInsights } from '../debts/types';
import type {
  ApiAccount,
  ApiMonthlyReport,
  ApiUpcomingPayment,
} from '../finance/types';

/** Confirmed income and expenses of one day (`dailyCashFlow`). */
export interface ApiDailyCashFlow {
  date: DayKey;
  income: number;
  expenses: number;
}

export interface DashboardData {
  accounts: ApiAccount[];
  monthlyReport: ApiMonthlyReport;
  upcomingPayments: ApiUpcomingPayment[];
  transactionCount: number;
  debtInsights: ApiDebtInsights;
  /** The last BALANCE_DAYS days of the accounts in the total. */
  balanceHistory?: ApiAllBalanceHistory | null;
  /** Every day from the 1st of last month to today. */
  cashFlow?: ApiDailyCashFlow[];
}

/** One of the home's analytics tiles. */
export interface DashboardStat {
  key: 'balance' | 'expenses' | 'income' | 'pending';
  label: string;
  value: string;
  /** Change vs the comparison period; null when there is nothing to compare. */
  trend: {
    /** "+12.5 %". */
    label: string;
    direction: 'up' | 'down' | 'flat';
    /** Good news (green), bad news (red) or neither. */
    tone: 'positive' | 'negative' | 'neutral';
  } | null;
  /** "vs mes anterior", "vs hace 30 días". */
  compareLabel: string | null;
  /** Instead of a trend, e.g. "2 próximos". */
  caption: string | null;
  /** Mini chart, oldest first (empty: no chart). */
  spark: number[];
  /** How the figure is computed. */
  hint: string;
}

/** An account in the home's "Cuentas" card. */
export interface DashboardAccount {
  id: string;
  name: string;
  type: ApiAccount['type'];
  last4: string | null;
  balance: string;
  /** The account's color, if the user chose one. */
  color: string | null;
  /** Left out of the total balance. */
  excluded: boolean;
}

export interface DashboardView {
  /** No accounts and no movements yet: show the welcome. */
  isEmpty: boolean;
  /** Today under the greeting, e.g. "Miércoles, 14 de octubre". */
  todayLabel: string;
  balance: {
    available: string;
    /** Owed on credit cards; null without credit cards. */
    creditDebt: string | null;
    net: string;
    accountCount: number;
    /** Totals in other currencies, e.g. "US$1,200.00 en USD". */
    otherCurrencies: string[];
  } | null;
  month: {
    label: string;
    income: string;
    expenses: string;
  };
  upcoming: PaymentRow[];
  /** Debt charts (built on the client); null without any debt. */
  debts: { insights: ApiDebtInsights; today: DayKey } | null;
  /** Saldo total, gastos, ingresos y pagos pendientes. */
  stats: DashboardStat[];
  /** The first MAX_ACCOUNTS accounts (those in the total first). */
  accounts: DashboardAccount[];
  /** Every open account ("Ver todas"). */
  accountCount: number;
}

export const UPCOMING_DAYS = 14;
const MAX_UPCOMING = 5;
/** Days of the balance tile's chart and comparison. */
export const BALANCE_DAYS = 30;
export const MAX_ACCOUNTS = 5;

/**
 * "+12.5%": one decimal, sign always, written without Intl so the server
 * and the browser agree (like formatMoney).
 */
function percentLabel(change: number): string {
  const sign = change > 0 ? '+' : change < 0 ? '-' : '';
  // From a tiny base the change means nothing: cap it.
  if (Math.abs(change) > MAX_CHANGE) return `>${sign}${MAX_CHANGE * 100}%`;
  return `${sign}${Math.abs(change * 100).toFixed(1)}%`;
}

/** Changes above +999% show as ">+999%". */
const MAX_CHANGE = 9.99;

/**
 * The change from `before` to `now` as a trend; null without a base to
 * compare with. `upIsGood` paints a rise green (income, balance) or red
 * (spending).
 */
function trendOf(
  now: number,
  before: number,
  upIsGood: boolean,
): DashboardStat['trend'] {
  if (before === 0) return null;
  const change = (now - before) / Math.abs(before);
  const rounded = Math.round(change * 1000) / 1000;
  const direction = rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'flat';
  return {
    label: percentLabel(rounded),
    direction,
    tone:
      direction === 'flat'
        ? 'neutral'
        : (direction === 'up') === upIsGood
          ? 'positive'
          : 'negative',
  };
}

/** Running totals of a month's days, from the 1st up to `lastDay`. */
function cumulative(
  flow: ReadonlyArray<ApiDailyCashFlow>,
  month: MonthRef,
  lastDay: number,
  pick: (day: ApiDailyCashFlow) => number,
): number[] {
  const byDay = new Map(flow.map((d) => [d.date, d]));
  const first = firstDayOf(month);
  const values: number[] = [];
  let total = 0;
  for (let i = 0; i < lastDay; i++) {
    const day = byDay.get(addDays(first, i));
    total += day ? pick(day) : 0;
    values.push(Math.round(total * 100) / 100);
  }
  return values;
}

/**
 * The analytics tiles: the total balance over the last 30 days, this
 * month's spending and income against the same days of last month, and
 * what is due in the next UPCOMING_DAYS days.
 */
function buildStats(
  data: DashboardData,
  today: DayKey,
  available: { amount: number; currency: string } | null,
  { locale, t }: Localizer,
): DashboardStat[] {
  const currency = available?.currency ?? data.monthlyReport.currency;
  const money = (n: number) => formatMoney(n, currency, locale);

  // Balance: each day's closing, oldest first.
  const days = [...(data.balanceHistory?.days ?? [])].reverse();
  const balanceSpark = days.map((d) => d.availableClosing);
  const balanceNow = available?.amount ?? 0;

  // Spending and income: running totals, this month vs last month.
  const current = monthOf(today);
  const previous = shiftMonth(current, -1);
  const day = Number(today.slice(8, 10));
  const flow = data.cashFlow ?? [];
  const sameDays = Math.min(day, daysInMonth(previous));
  const series = (pick: (d: ApiDailyCashFlow) => number) => {
    const now = cumulative(flow, current, day, pick);
    const before = cumulative(flow, previous, sameDays, pick);
    return {
      spark: now,
      now: now[now.length - 1] ?? 0,
      before: before[before.length - 1] ?? 0,
    };
  };
  const expenses = series((d) => d.expenses);
  const income = series((d) => d.income);
  const hasFlow = flow.length > 0;
  const expensesNow = hasFlow ? expenses.now : data.monthlyReport.totalExpenses;
  const incomeNow = hasFlow ? income.now : data.monthlyReport.totalIncome;

  // Still to pay (not paid or skipped) in the next UPCOMING_DAYS days.
  const due = data.upcomingPayments.filter(
    (p) => toPaymentRow(p, today, { locale, t }).open,
  );
  const dueTotal = due.reduce((sum, p) => sum + p.expectedAmount, 0);

  const vsMonth = t('dashboard.stats.vsLastMonth');
  return [
    {
      key: 'balance',
      label: t('dashboard.stats.balance'),
      value: money(balanceNow),
      trend:
        balanceSpark.length > 1
          ? trendOf(balanceNow, balanceSpark[0]!, true)
          : null,
      compareLabel: t('dashboard.stats.vsDaysAgo', { days: BALANCE_DAYS }),
      caption: null,
      spark: balanceSpark,
      hint: t('dashboard.stats.balanceHint', { days: BALANCE_DAYS }),
    },
    {
      key: 'expenses',
      label: t('dashboard.stats.expenses'),
      value: money(expensesNow),
      trend: hasFlow ? trendOf(expenses.now, expenses.before, false) : null,
      compareLabel: vsMonth,
      caption: null,
      spark: expenses.spark,
      hint: t('dashboard.stats.expensesHint'),
    },
    {
      key: 'income',
      label: t('dashboard.stats.income'),
      value: money(incomeNow),
      trend: hasFlow ? trendOf(income.now, income.before, true) : null,
      compareLabel: vsMonth,
      caption: null,
      spark: income.spark,
      hint: t('dashboard.stats.incomeHint'),
    },
    {
      key: 'pending',
      label: t('dashboard.stats.pending'),
      value: money(dueTotal),
      trend: null,
      compareLabel: null,
      caption: t('dashboard.stats.upcomingCount', { count: due.length }),
      spark: [],
      hint: t('dashboard.stats.pendingHint', { days: UPCOMING_DAYS }),
    },
  ];
}

/** The "Cuentas" card: those in the total first, the biggest balance first. */
function buildAccounts(
  accounts: ReadonlyArray<ApiAccount>,
  { locale }: Localizer,
): DashboardAccount[] {
  return [...accounts]
    .sort(
      (a, b) =>
        Number(countsInTotal(b)) - Number(countsInTotal(a)) ||
        b.balanceCurrent - a.balanceCurrent,
    )
    .slice(0, MAX_ACCOUNTS)
    .map((a) => ({
      id: a.id,
      name: accountLabel(a),
      type: a.type,
      last4: a.metadata?.last4 ?? null,
      balance: formatMoney(a.balanceCurrent, a.currency, locale),
      color: a.metadata?.design?.primaryColor ?? null,
      excluded: !countsInTotal(a),
    }));
}

export function buildDashboardView(
  data: DashboardData,
  { today, month }: { today: DayKey; month: MonthRef },
  l: Localizer,
): DashboardView {
  const { locale, t } = l;
  const accounts = data.accounts.filter((a) => !a.archived);
  const [main, ...others] = summarizeBalances(accounts);
  const currency = data.monthlyReport.currency;
  const hasCredit = accounts.some(
    (a) => a.type === 'credit' && a.currency === main?.currency,
  );

  return {
    isEmpty: accounts.length === 0 && data.transactionCount === 0,
    todayLabel: weekdayDate(today, locale),
    balance: main
      ? {
          available: formatMoney(main.available, main.currency, locale),
          creditDebt: hasCredit
            ? formatMoney(main.creditDebt, main.currency, locale)
            : null,
          net: formatMoney(main.net, main.currency, locale),
          accountCount: accounts.length,
          otherCurrencies: others.map((o) =>
            t('finance.inCurrency', {
              amount: formatMoney(o.net, o.currency, locale),
              currency: o.currency,
            }),
          ),
        }
      : null,
    month: {
      label: monthLabel(month, locale),
      income: formatMoney(data.monthlyReport.totalIncome, currency, locale),
      expenses: formatMoney(data.monthlyReport.totalExpenses, currency, locale),
    },
    upcoming: data.upcomingPayments
      .map((p) => toPaymentRow(p, today, l))
      .filter((p) => p.open)
      .slice(0, MAX_UPCOMING),
    // Card MSI plans alone are not shown here (they live in the cards).
    debts: data.debtInsights.byType.some(
      (type) => type.type !== 'msi' && type.count > 0,
    )
      ? { insights: data.debtInsights, today }
      : null,
    stats: buildStats(
      data,
      today,
      main ? { amount: main.available, currency: main.currency } : null,
      l,
    ),
    accounts: buildAccounts(accounts, l),
    accountCount: accounts.length,
  };
}

/**
 * The same view with every amount hidden ("ocultar montos"): balances,
 * analytics, accounts and payments show MASKED_AMOUNT, and the charts lose
 * their shape (no sparkline, no trend). The debt block hides its figures
 * itself.
 */
export function maskDashboardView(view: DashboardView): DashboardView {
  const m = MASKED_AMOUNT;
  return {
    ...view,
    balance: view.balance
      ? {
          ...view.balance,
          available: m,
          creditDebt: view.balance.creditDebt ? m : null,
          net: m,
          otherCurrencies: view.balance.otherCurrencies.map(() => m),
        }
      : null,
    month: { ...view.month, income: m, expenses: m },
    upcoming: view.upcoming.map((row) => ({ ...row, amount: m })),
    stats: view.stats.map((stat) => ({
      ...stat,
      value: m,
      trend: null,
      spark: [],
    })),
    accounts: view.accounts.map((account) => ({ ...account, balance: m })),
  };
}
