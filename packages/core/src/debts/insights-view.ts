import {
  dayKeyOf,
  longDate,
  shortMonthLabel,
  type DayKey,
} from '../finance/dates';
import {
  DEFAULT_CURRENCY,
  formatMoney,
  percentOf,
  roundCents,
} from '../finance/money';
import type { Localizer } from '../i18n/translator';
import {
  DEBT_CATEGORIES,
  type ApiDebtInsights,
  type DebtCategory,
} from './types';

/**
 * The debts charts as plain props. Card MSI plans use a card's credit line
 * and loans don't, so they are left out unless `includeMsi`.
 */

/** Chart color of each category: fixed by category, never by rank. */
export const CATEGORY_COLOR: Record<DebtCategory, string> = {
  institutional: 'var(--chart-1)',
  personal: 'var(--chart-2)',
  purchase_financing: 'var(--chart-3)',
  card: 'var(--chart-4)',
  other: 'var(--chart-5)',
  msi: 'var(--chart-6)',
};

/** Paid-by-month series, in stack order (first three chart slots). */
export const PAID_SERIES = ['counted', 'historical', 'msi'] as const;
export type PaidSeries = (typeof PAID_SERIES)[number];

export const PAID_COLOR: Record<PaidSeries, string> = {
  counted: 'var(--chart-1)',
  historical: 'var(--chart-2)',
  msi: 'var(--chart-3)',
};

/** Share of income that goes to debt payments. */
export type LoadLevel = 'low' | 'moderate' | 'high';

export interface TypeBar {
  type: DebtCategory;
  label: string;
  amount: string;
  /** Width relative to the biggest bar (0–100). */
  percent: number;
  count: number;
  color: string;
}

export interface PaidMonthBar {
  key: string;
  label: string;
  total: string;
  segments: { series: PaidSeries; value: number; amount: string }[];
  /** Height relative to the biggest month (0–100). */
  percent: number;
}

export interface ProjectionPoint {
  key: string;
  label: string;
  value: number;
  amount: string;
}

export interface MsiRow {
  id: string;
  name: string;
  /** The purchase's page (null: an old plan, only a recurring expense). */
  href: string | null;
  accountName: string | null;
  progress: string;
  paidPercent: number;
  installment: string;
  remaining: string;
  nextLabel: string | null;
}

export interface DebtInsightsView {
  current: string;
  total: string;
  paid: string;
  /** Of everything owed over time, the part already paid (0–100). */
  paidPercent: number;
  types: TypeBar[];
  months: PaidMonthBar[];
  /** Months with any payment (for the empty state). */
  hasPayments: boolean;
  /** Series that appear in the paid-by-month chart. */
  paidSeries: PaidSeries[];
  projection: ProjectionPoint[];
  /** Month the projection reaches zero, or null when it doesn't. */
  paidOffLabel: string | null;
  upcoming: { days30: string; days60: string; days90: string };
  monthly: string;
  /** Payments ÷ income, or null without income. */
  load: { percent: number; level: LoadLevel; income: string } | null;
  msi: MsiRow[];
  /** There are MSI plans to include (the toggle shows only then). */
  hasMsi: boolean;
}

/** "Oct 26" from "2026-10". */
function monthLabel(key: string, locale: Localizer['locale']): string {
  const [year, month] = key.split('-').map(Number) as [number, number];
  return `${shortMonthLabel({ year, month }, locale)} ${String(year).slice(2)}`;
}

/** Debt load: up to 20% of income is low, up to 35% moderate. */
export function loadLevel(percent: number): LoadLevel {
  if (percent <= 20) return 'low';
  if (percent <= 35) return 'moderate';
  return 'high';
}

export function buildDebtInsightsView(
  data: ApiDebtInsights,
  { today, includeMsi }: { today: DayKey; includeMsi: boolean },
  { locale, t }: Localizer,
): DebtInsightsView {
  const money = (n: number) =>
    formatMoney(n, DEFAULT_CURRENCY, locale, { wholeUnits: true });
  const exact = (n: number) => formatMoney(n, DEFAULT_CURRENCY, locale);
  const kept = data.byType.filter((row) => includeMsi || row.type !== 'msi');

  const remaining = roundCents(kept.reduce((s, r) => s + r.remaining, 0));
  const totalOwed = roundCents(kept.reduce((s, r) => s + r.totalOwed, 0));
  const paid = roundCents(kept.reduce((s, r) => s + r.paid, 0));

  const owedTypes = DEBT_CATEGORIES.map((type) =>
    kept.find((r) => r.type === type),
  ).filter((r): r is (typeof kept)[number] => Boolean(r && r.remaining > 0));
  const maxType = Math.max(0, ...owedTypes.map((r) => r.remaining));

  const series = PAID_SERIES.filter((s) => includeMsi || s !== 'msi');
  const monthTotals = data.paidByMonth.map((m) =>
    series.reduce((sum, s) => sum + m[s], 0),
  );
  const maxMonth = Math.max(0, ...monthTotals);

  const projection = data.projection.map((p) => {
    const value = roundCents(p.debt + (includeMsi ? p.msi : 0));
    return {
      key: p.month,
      label: monthLabel(p.month, locale),
      value,
      amount: money(value),
    };
  });
  const zero = projection.find((p) => p.value <= 0);

  const upcoming = (key: 'days30' | 'days60' | 'days90') =>
    money(data.upcoming[key] + (includeMsi ? data.upcomingMsi[key] : 0));
  const monthly = roundCents(
    data.monthlyPayments + (includeMsi ? data.msiMonthlyPayments : 0),
  );
  const loadPercent =
    data.averageMonthlyIncome > 0
      ? Math.round((monthly / data.averageMonthlyIncome) * 100)
      : null;

  return {
    current: money(remaining),
    total: money(totalOwed),
    paid: money(paid),
    paidPercent: Math.min(100, percentOf(paid, totalOwed)),
    types: owedTypes.map((row) => ({
      type: row.type,
      label: t(`debts.categories.${row.type}`),
      amount: money(row.remaining),
      percent: maxType > 0 ? (row.remaining / maxType) * 100 : 0,
      count: row.count,
      color: CATEGORY_COLOR[row.type],
    })),
    months: data.paidByMonth.map((m, i) => ({
      key: m.month,
      label: monthLabel(m.month, locale),
      total: money(monthTotals[i]!),
      segments: series.map((s) => ({
        series: s,
        value: m[s],
        amount: money(m[s]),
      })),
      percent: maxMonth > 0 ? (monthTotals[i]! / maxMonth) * 100 : 0,
    })),
    hasPayments: maxMonth > 0,
    paidSeries: series,
    projection,
    paidOffLabel: zero && remaining > 0 ? zero.label : null,
    upcoming: {
      days30: upcoming('days30'),
      days60: upcoming('days60'),
      days90: upcoming('days90'),
    },
    monthly: money(monthly),
    load:
      loadPercent !== null
        ? {
            percent: loadPercent,
            level: loadLevel(loadPercent),
            income: money(data.averageMonthlyIncome),
          }
        : null,
    msi: data.msi.map((plan) => ({
      id: plan.id,
      name: plan.name,
      href: plan.debtId
        ? `/planning/debts/${encodeURIComponent(plan.debtId)}`
        : null,
      accountName: plan.accountName,
      progress: t('debts.msi.progress', {
        paid: plan.installmentsPaid,
        total: plan.installmentsTotal,
      }),
      paidPercent: percentOf(plan.installmentsPaid, plan.installmentsTotal),
      installment: exact(plan.installmentAmount),
      remaining: exact(plan.remaining),
      nextLabel: plan.nextDueDate
        ? longDate(dayKeyOf(plan.nextDueDate), today, locale)
        : null,
    })),
    hasMsi: data.msi.some((plan) => plan.remaining > 0),
  };
}
