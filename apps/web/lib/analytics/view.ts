import { spendingByCategory } from '@/lib/finance/breakdown';
import { indexCategories, type IconKey } from '@/lib/finance/categories';
import {
  dayKeyOf,
  formatMonthParam,
  monthLabel,
  monthOf,
  sameMonth,
  shiftMonth,
  shortMonthLabel,
  type MonthRef,
} from '@/lib/finance/dates';
import { formatMoney, percentOf } from '@/lib/finance/money';
import type { ApiCategory, ApiMonthlyReport } from '@/lib/finance/types';

export const TREND_MONTHS = 6;

export interface ProjectionPoint {
  date: string;
  projectedBalance: number;
}

export interface AnalyticsData {
  /** Oldest first; the last one is the selected month. */
  reports: ApiMonthlyReport[];
  categories: ApiCategory[];
  projection: ProjectionPoint[];
  accountCount: number;
}

export interface AnalyticsView {
  isEmpty: boolean;
  month: {
    label: string;
    prevHref: string;
    /** Null on the current month (no future months). */
    nextHref: string | null;
  };
  spending: {
    amount: string;
    /** "12%" vs the previous month; null when it had no expenses. */
    trendPercent: string | null;
    trendDown: boolean;
    bars: { heightPercent: number; highlighted: boolean }[];
  };
  savings: {
    /** Donut value, 0–100. */
    percentage: number;
    rating: string;
    caption: string;
  } | null;
  trend: {
    label: string;
    income: string;
    expenses: string;
    incomePercent: number;
    expensePercent: number;
  }[];
  categories: {
    id: string;
    label: string;
    amount: string;
    percent: number;
    iconKey: IconKey;
    color: string;
  }[];
  projection: {
    label: string;
    balance: string;
    value: number;
  }[];
}

/** The months to fetch: the selected one and the 5 before it. */
export function trendMonths(selected: MonthRef): MonthRef[] {
  return Array.from({ length: TREND_MONTHS }, (_, i) =>
    shiftMonth(selected, i - (TREND_MONTHS - 1)),
  );
}

function savingsRating(rate: number): string {
  if (rate >= 20) return 'Excelente';
  if (rate >= 10) return 'Buena';
  if (rate >= 0) return 'Ajustada';
  return 'Negativa';
}

export function buildAnalyticsView(
  data: AnalyticsData,
  { selected, current }: { selected: MonthRef; current: MonthRef },
): AnalyticsView {
  const reports = data.reports;
  const report = reports[reports.length - 1]!;
  const previous = reports[reports.length - 2];
  const currency = report.currency;
  const money = (n: number) => formatMoney(n, currency);
  const href = (m: MonthRef) => `/analytics?month=${formatMonthParam(m)}`;

  const maxExpenses = Math.max(...reports.map((r) => r.totalExpenses));
  const maxFlow = Math.max(
    ...reports.flatMap((r) => [r.totalIncome, r.totalExpenses]),
  );

  const change =
    previous && previous.totalExpenses > 0
      ? (report.totalExpenses - previous.totalExpenses) / previous.totalExpenses
      : null;

  const income = report.totalIncome;
  const rate =
    income > 0
      ? Math.round(((income - report.totalExpenses) / income) * 100)
      : null;

  return {
    isEmpty:
      data.accountCount === 0 &&
      reports.every((r) => r.totalIncome === 0 && r.totalExpenses === 0),
    month: {
      label: monthLabel(selected),
      prevHref: href(shiftMonth(selected, -1)),
      nextHref: sameMonth(selected, current)
        ? null
        : href(shiftMonth(selected, 1)),
    },
    spending: {
      amount: money(report.totalExpenses),
      trendPercent:
        change === null ? null : `${Math.abs(Math.round(change * 100))}%`,
      trendDown: (change ?? 0) <= 0,
      bars: reports.map((r, i) => ({
        // A sliver keeps empty months visible as bars.
        heightPercent: Math.max(4, percentOf(r.totalExpenses, maxExpenses)),
        highlighted: i === reports.length - 1,
      })),
    },
    savings:
      rate === null
        ? null
        : {
            percentage: Math.min(100, Math.max(0, rate)),
            rating: savingsRating(rate),
            caption:
              rate >= 0
                ? `Ahorraste ${money(income - report.totalExpenses)} de ${money(income)} de ingresos (${rate}%).`
                : `Gastaste ${money(report.totalExpenses - income)} más de lo que ingresó.`,
          },
    trend: reports.map((r) => ({
      label: shortMonthLabel(r),
      income: money(r.totalIncome),
      expenses: money(r.totalExpenses),
      incomePercent: percentOf(r.totalIncome, maxFlow),
      expensePercent: percentOf(r.totalExpenses, maxFlow),
    })),
    categories: spendingByCategory(
      report,
      indexCategories(data.categories),
    ).map((c) => ({ ...c, amount: money(c.amount) })),
    projection: data.projection.map((p) => ({
      label: shortMonthLabel(monthOf(dayKeyOf(p.date))),
      balance: money(p.projectedBalance),
      value: p.projectedBalance,
    })),
  };
}
