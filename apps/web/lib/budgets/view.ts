import {
  ICON_COLORS,
  categoryIconKey,
  indexCategories,
  type CategoryIndex,
  type IconKey,
} from '@/lib/finance/categories';
import {
  formatMonthParam,
  monthLabel,
  sameMonth,
  shiftMonth,
  type MonthRef,
} from '@/lib/finance/dates';
import { formatMoney, roundCents } from '@/lib/finance/money';
import type { ApiMonthlyReport } from '@/lib/finance/types';
import type { Localizer } from '@/lib/i18n/translator';
import { capStatus, usedPercent, type CapStatus } from './status';
import { suggestCaps, type CapSuggestion } from './suggestions';
import type {
  ApiBudget,
  ApiBudgetSummary,
  ApiBudgetUsage,
  BudgetCategory,
} from './types';

/**
 * What the budgets screen shows for a month: the budget against what was
 * spent, each category cap, alerts and the spending no cap covers; or,
 * without a budget, how to start one.
 */
export const BUDGETS_PATH = '/planning/budgets';

/** How far ahead a budget can be planned. */
export const MAX_MONTHS_AHEAD = 12;

export function budgetsHref(month: MonthRef): string {
  return `${BUDGETS_PATH}?month=${formatMonthParam(month)}`;
}

export interface CapItem {
  categoryId: string;
  name: string;
  /** The top-level category, for a subcategory. */
  parentName: string | null;
  iconKey: IconKey;
  color: string;
  budgetedValue: number;
  budgeted: string;
  spent: string;
  /** "Quedan $X" amount, or what it went over by. */
  remaining: string;
  over: boolean;
  /** Whole percent, may exceed 100. */
  percent: number;
  status: CapStatus;
}

export interface AlertItem {
  categoryId: string;
  status: Exclude<CapStatus, 'ok'>;
  text: string;
}

export interface BudgetTotals {
  budgeted: string;
  spent: string;
  remaining: string;
  over: boolean;
  percent: number;
  status: CapStatus;
  /** True when the user set an overall limit (not just the caps' sum). */
  explicitTotal: boolean;
  capsSum: string;
}

export interface MonthBudgetView {
  id: string;
  /** For the edit dialog. */
  budget: ApiBudget;
  totals: BudgetTotals;
  caps: CapItem[];
  alerts: AlertItem[];
  /** Spending without a category (null when there's none). */
  uncategorized: string | null;
  /** Spending in categories without a cap (null when there's none). */
  uncapped: string | null;
}

export interface SuggestionItem extends CapSuggestion {
  name: string;
  iconKey: IconKey;
  color: string;
  averageLabel: string;
  capLabel: string;
}

export interface EmptyMonthView {
  /** The latest earlier budget, to copy. */
  template: { budgetId: string; monthLabel: string } | null;
  suggestions: SuggestionItem[];
  suggestionsTotal: string;
  /** Months with spending the suggestions average over. */
  suggestionMonths: number;
}

export interface BudgetsView {
  month: {
    ref: MonthRef;
    label: string;
    prevHref: string;
    nextHref: string | null;
    isCurrent: boolean;
  };
  currency: string;
  categories: BudgetCategory[];
  budget: MonthBudgetView | null;
  empty: EmptyMonthView | null;
}

export interface BudgetsData {
  budgets: ApiBudget[];
  categories: BudgetCategory[];
  /** Null when the month has no budget. */
  summary: ApiBudgetSummary | null;
  /** The selected month's report (spending outside the caps). */
  report: ApiMonthlyReport;
  /** The months before the selected one, for suggestions. */
  previousReports: ApiMonthlyReport[];
}

const compareMonths = (a: MonthRef, b: MonthRef) =>
  a.year * 12 + a.month - (b.year * 12 + b.month);

/** The budget of a month, if any. */
export function budgetOf(
  budgets: ReadonlyArray<ApiBudget>,
  month: MonthRef,
): ApiBudget | null {
  return budgets.find((b) => sameMonth(b, month)) ?? null;
}

/** The most recent budget before a month (the one to copy). */
export function templateFor(
  budgets: ReadonlyArray<ApiBudget>,
  month: MonthRef,
): ApiBudget | null {
  return (
    [...budgets]
      .filter((b) => compareMonths(b, month) < 0)
      .sort((a, b) => compareMonths(b, a))[0] ?? null
  );
}

/** The overall limit: the one set by the user, else the sum of the caps. */
export function budgetLimit(budget: ApiBudget): number {
  if (budget.amountTotal != null) return budget.amountTotal;
  return roundCents(budget.categories.reduce((s, c) => s + c.capAmount, 0));
}

/** Whether a category or one of its ancestors has a cap. */
function isCovered(
  index: CategoryIndex,
  capped: ReadonlySet<string>,
  categoryId: string,
): boolean {
  let node = index.get(categoryId);
  for (let i = 0; node && i < 10; i++) {
    if (capped.has(node.id)) return true;
    node = node.parentId ? index.get(node.parentId) : undefined;
  }
  return capped.has(categoryId);
}

/**
 * Spending no cap covers, from the month's report: without a category, and
 * in categories that neither have a cap nor sit under one.
 */
export function outsideCaps(
  report: ApiMonthlyReport,
  cappedIds: ReadonlyArray<string>,
  categories: ReadonlyArray<BudgetCategory>,
): { uncategorized: number; uncapped: number } {
  const index = indexCategories(categories);
  const capped = new Set(cappedIds);
  const categorized = report.categoryBreakdown.reduce(
    (sum, line) => sum + line.amount,
    0,
  );
  const uncapped = report.categoryBreakdown
    .filter((line) => !isCovered(index, capped, line.categoryId))
    .reduce((sum, line) => sum + line.amount, 0);
  return {
    uncategorized: Math.max(0, roundCents(report.totalExpenses - categorized)),
    uncapped: roundCents(uncapped),
  };
}

function capItem(
  usage: ApiBudgetUsage,
  index: CategoryIndex,
  currency: string,
  { locale, t }: Localizer,
): CapItem {
  const category = index.get(usage.categoryId);
  const parent = category?.parentId ? index.get(category.parentId) : null;
  const iconKey = categoryIconKey(index, usage.categoryId);
  const money = (n: number) => formatMoney(n, currency, locale);
  const remaining = roundCents(usage.budgeted - usage.spent);
  return {
    categoryId: usage.categoryId,
    name: category?.name ?? t('budgets.deletedCategory'),
    parentName: parent?.name ?? null,
    iconKey,
    color: ICON_COLORS[iconKey],
    budgetedValue: usage.budgeted,
    budgeted: money(usage.budgeted),
    spent: money(usage.spent),
    remaining: money(Math.abs(remaining)),
    over: remaining < 0,
    percent: usedPercent(usage.spent, usage.budgeted),
    status: capStatus(usage.spent, usage.budgeted),
  };
}

function alertText(item: CapItem, { t }: Localizer): string {
  if (item.over) {
    return t('budgets.alerts.over', {
      category: item.name,
      amount: item.remaining,
    });
  }
  if (item.status === 'over') {
    return t('budgets.alerts.reached', { category: item.name });
  }
  return t('budgets.alerts.warning', {
    category: item.name,
    percent: item.percent,
    amount: item.remaining,
  });
}

/** Caps and alerts, the fullest first. */
function monthBudget(
  budget: ApiBudget,
  data: BudgetsData,
  l: Localizer,
): MonthBudgetView {
  const { locale } = l;
  const index = indexCategories(data.categories);
  const money = (n: number) => formatMoney(n, budget.currency, locale);

  // Usage comes from the summary; a cap it doesn't list counts as unspent.
  const usage = budget.categories.map(
    (cap) =>
      data.summary?.categoryUsage.find(
        (u) => u.categoryId === cap.categoryId,
      ) ?? {
        categoryId: cap.categoryId,
        budgeted: cap.capAmount,
        spent: 0,
        remaining: cap.capAmount,
        percentage: 0,
      },
  );
  const caps = usage
    .map((u) => capItem(u, index, budget.currency, l))
    .sort((a, b) => b.percent - a.percent || b.budgetedValue - a.budgetedValue);

  const limit = budgetLimit(budget);
  const spent = data.summary?.totalSpent ?? data.report.totalExpenses;
  const remaining = roundCents(limit - spent);
  const outside = outsideCaps(
    data.report,
    budget.categories.map((c) => c.categoryId),
    data.categories,
  );

  return {
    id: budget.id,
    budget,
    totals: {
      budgeted: money(limit),
      spent: money(spent),
      remaining: money(Math.abs(remaining)),
      over: remaining < 0,
      percent: usedPercent(spent, limit),
      status: capStatus(spent, limit),
      explicitTotal: budget.amountTotal != null,
      capsSum: money(
        roundCents(budget.categories.reduce((s, c) => s + c.capAmount, 0)),
      ),
    },
    caps,
    alerts: caps
      .filter((c) => c.status !== 'ok')
      .map((c) => ({
        categoryId: c.categoryId,
        status: c.status as AlertItem['status'],
        text: alertText(c, l),
      })),
    uncategorized:
      outside.uncategorized > 0 ? money(outside.uncategorized) : null,
    // With no caps at all, "outside the caps" would be everything: say nothing.
    uncapped:
      budget.categories.length > 0 && outside.uncapped > 0
        ? money(outside.uncapped)
        : null,
  };
}

function emptyMonth(
  month: MonthRef,
  data: BudgetsData,
  currency: string,
  { locale }: Localizer,
): EmptyMonthView {
  const index = indexCategories(data.categories);
  const template = templateFor(data.budgets, month);
  const suggestions = suggestCaps(data.previousReports, data.categories).map(
    (s) => {
      const iconKey = categoryIconKey(index, s.categoryId);
      return {
        ...s,
        name: index.get(s.categoryId)?.name ?? '',
        iconKey,
        color: ICON_COLORS[iconKey],
        averageLabel: formatMoney(s.average, currency, locale),
        capLabel: formatMoney(s.cap, currency, locale, { wholeUnits: true }),
      };
    },
  );
  return {
    template: template
      ? { budgetId: template.id, monthLabel: monthLabel(template, locale) }
      : null,
    suggestions,
    suggestionsTotal: formatMoney(
      suggestions.reduce((sum, s) => sum + s.cap, 0),
      currency,
      locale,
      { wholeUnits: true },
    ),
    suggestionMonths: data.previousReports.filter((r) => r.totalExpenses > 0)
      .length,
  };
}

export function buildBudgetsView(
  data: BudgetsData,
  {
    selected,
    current,
    currency,
  }: {
    selected: MonthRef;
    current: MonthRef;
    /** For a new budget (the user's main currency). */
    currency: string;
  },
  l: Localizer,
): BudgetsView {
  const budget = budgetOf(data.budgets, selected);
  const next = shiftMonth(selected, 1);
  return {
    month: {
      ref: selected,
      label: monthLabel(selected, l.locale),
      prevHref: budgetsHref(shiftMonth(selected, -1)),
      nextHref:
        compareMonths(next, shiftMonth(current, MAX_MONTHS_AHEAD)) <= 0
          ? budgetsHref(next)
          : null,
      isCurrent: sameMonth(selected, current),
    },
    currency: budget?.currency ?? currency,
    categories: data.categories,
    budget: budget ? monthBudget(budget, data, l) : null,
    empty: budget ? null : emptyMonth(selected, data, currency, l),
  };
}

/** The dashboard's compact card: the month's budget against its spending. */
export interface BudgetCardView {
  monthLabel: string;
  spent: string;
  budgeted: string;
  remaining: string;
  over: boolean;
  percent: number;
  status: CapStatus;
}

export function buildBudgetCard(
  budget: ApiBudget,
  spent: number,
  { locale }: Localizer,
): BudgetCardView {
  const limit = budgetLimit(budget);
  const remaining = roundCents(limit - spent);
  const money = (n: number) => formatMoney(n, budget.currency, locale);
  return {
    monthLabel: monthLabel(budget, locale),
    spent: money(spent),
    budgeted: money(limit),
    remaining: money(Math.abs(remaining)),
    over: remaining < 0,
    percent: usedPercent(spent, limit),
    status: capStatus(spent, limit),
  };
}
