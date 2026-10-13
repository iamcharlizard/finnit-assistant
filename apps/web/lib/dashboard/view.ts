import { summarizeBalances } from '@/lib/finance/accounts';
import { indexCategories } from '@/lib/finance/categories';
import { monthLabel, type DayKey, type MonthRef } from '@/lib/finance/dates';
import { formatMoney } from '@/lib/finance/money';
import { toPaymentRow, type PaymentRow } from '@/lib/finance/payments';
import {
  toTransactionRow,
  type TransactionRow,
} from '@/lib/finance/transactions';
import type {
  ApiAccount,
  ApiCategory,
  ApiMonthlyReport,
  ApiTransaction,
  ApiUpcomingPayment,
} from '@/lib/finance/types';

export interface DashboardData {
  accounts: ApiAccount[];
  monthlyReport: ApiMonthlyReport;
  upcomingPayments: ApiUpcomingPayment[];
  transactions: ApiTransaction[];
  transactionCount: number;
  categories: ApiCategory[];
}

export interface DashboardView {
  /** No accounts and no movements yet: show the welcome. */
  isEmpty: boolean;
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
  recent: TransactionRow[];
}

export const UPCOMING_DAYS = 14;
const MAX_UPCOMING = 5;

export function buildDashboardView(
  data: DashboardData,
  { today, month }: { today: DayKey; month: MonthRef },
): DashboardView {
  const accounts = data.accounts.filter((a) => !a.archived);
  const [main, ...others] = summarizeBalances(accounts);
  const categories = indexCategories(data.categories);
  const currency = data.monthlyReport.currency;
  const hasCredit = accounts.some(
    (a) => a.type === 'credit' && a.currency === main?.currency,
  );

  return {
    isEmpty: accounts.length === 0 && data.transactionCount === 0,
    balance: main
      ? {
          available: formatMoney(main.available, main.currency),
          creditDebt: hasCredit
            ? formatMoney(main.creditDebt, main.currency)
            : null,
          net: formatMoney(main.net, main.currency),
          accountCount: accounts.length,
          otherCurrencies: others.map(
            (o) => `${formatMoney(o.net, o.currency)} en ${o.currency}`,
          ),
        }
      : null,
    month: {
      label: monthLabel(month),
      income: formatMoney(data.monthlyReport.totalIncome, currency),
      expenses: formatMoney(data.monthlyReport.totalExpenses, currency),
    },
    upcoming: data.upcomingPayments
      .map((p) => toPaymentRow(p, today))
      .filter((p) => p.open)
      .slice(0, MAX_UPCOMING),
    recent: data.transactions.map((tx) =>
      toTransactionRow(tx, categories, { withDate: true }),
    ),
  };
}
