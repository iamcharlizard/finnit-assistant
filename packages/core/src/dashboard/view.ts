import type { Localizer } from '../i18n/translator';
import { summarizeBalances } from '../finance/accounts';
import {
  monthLabel,
  weekdayDate,
  type DayKey,
  type MonthRef,
} from '../finance/dates';
import { formatMoney } from '../finance/money';
import { toPaymentRow, type PaymentRow } from '../finance/payments';
import type { ApiDebtInsights } from '../debts/types';
import type {
  ApiAccount,
  ApiMonthlyReport,
  ApiUpcomingPayment,
} from '../finance/types';

export interface DashboardData {
  accounts: ApiAccount[];
  monthlyReport: ApiMonthlyReport;
  upcomingPayments: ApiUpcomingPayment[];
  transactionCount: number;
  debtInsights: ApiDebtInsights;
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
}

export const UPCOMING_DAYS = 14;
const MAX_UPCOMING = 5;

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
  };
}
