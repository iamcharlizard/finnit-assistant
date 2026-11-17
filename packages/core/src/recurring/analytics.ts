/**
 * "Pagos recurrentes" → Análisis: how much goes to recurring expenses each
 * month, by category and by kind, and (once the questionnaire is answered)
 * what the AI judged essential, reducible or dispensable, with what cutting
 * the dispensable ones would save. Loans are debts, not choices: they show
 * apart. Shared by the web and the mobile app.
 */
import { pieSlices, type PieSlice } from '../finance/pie';
import { DEFAULT_CURRENCY, formatMoney, roundCents } from '../finance/money';
import type { Localizer } from '../i18n/translator';
import type { EssentialLevel } from './types';
import type { RecurringData } from './view';

export const ESSENTIAL_LEVELS = [
  'essential',
  'reducible',
  'dispensable',
] as const satisfies ReadonlyArray<EssentialLevel>;

/** Colors of the levels, in their fixed order (chart tokens). */
export const LEVEL_COLOR: Record<EssentialLevel, string> = {
  essential: 'var(--chart-1)',
  reducible: 'var(--chart-2)',
  dispensable: 'var(--chart-3)',
};

export interface AnalyzedExpense {
  id: string;
  name: string;
  category: string | null;
  amount: string;
  value: number;
  level: EssentialLevel;
  levelLabel: string;
  reason: string | null;
}

export interface RecurringAnalytics {
  currency: string;
  /** Active recurring expenses a month (loans included). */
  monthly: string;
  count: number;
  /** Donut slices (six at most, the rest in "Otros"). */
  byCategory: PieSlice[];
  byKind: PieSlice[];
  /** Loans and installments: owed, not a choice. */
  debts: { amount: string; count: number };
  essentials: {
    levels: {
      level: EssentialLevel;
      label: string;
      amount: string;
      value: number;
      count: number;
      /** Share of what was analyzed, 0–100. */
      percent: number;
    }[];
    /** Cutting every dispensable one, a month. */
    savings: string;
    savingsValue: number;
    /** Dispensable first, then reducible, then essential; largest first. */
    items: AnalyzedExpense[];
    /** Active ones (not loans) the AI hasn't judged yet. */
    pending: number;
  };
}

const isDebt = (e: { kind: string; debtId?: string | null }) =>
  e.kind === 'loan' || e.kind === 'installment' || Boolean(e.debtId);

const LEVEL_ORDER: Record<EssentialLevel, number> = {
  dispensable: 0,
  reducible: 1,
  essential: 2,
};

export function buildRecurringAnalytics(
  data: Pick<RecurringData, 'expenses' | 'categories' | 'monthlyTotals'>,
  { locale, t }: Localizer,
): RecurringAnalytics {
  const currency = data.monthlyTotals[0]?.currency ?? DEFAULT_CURRENCY;
  const money = (n: number) => formatMoney(roundCents(n), currency, locale);
  const active = data.expenses.filter(
    (e) => e.active && e.currency === currency,
  );
  const categoriesById = new Map(data.categories.map((c) => [c.id, c]));
  // Subcategories add up to their parent (the chart stays short).
  const topCategory = (id: string | null) => {
    let category = id ? categoriesById.get(id) : undefined;
    while (category?.parentId) {
      const parent = categoriesById.get(category.parentId);
      if (!parent) break;
      category = parent;
    }
    return category;
  };

  const byCategory = new Map<
    string,
    { label: string; value: number; count: number }
  >();
  const byKind = new Map<
    string,
    { label: string; value: number; count: number }
  >();
  let monthly = 0;
  let debtValue = 0;
  let debtCount = 0;
  for (const e of active) {
    monthly += e.monthlyCost;
    const category = topCategory(e.categoryId);
    const key = category?.id ?? 'none';
    const entry = byCategory.get(key) ?? {
      label: category?.name ?? t('recurring.analytics.noCategory'),
      value: 0,
      count: 0,
    };
    entry.value += e.monthlyCost;
    entry.count += 1;
    byCategory.set(key, entry);
    const kind = byKind.get(e.kind) ?? {
      label: t(`finance.recurringKinds.${e.kind}`),
      value: 0,
      count: 0,
    };
    kind.value += e.monthlyCost;
    kind.count += 1;
    byKind.set(e.kind, kind);
    if (isDebt(e)) {
      debtValue += e.monthlyCost;
      debtCount += 1;
    }
  }

  const choices = active.filter((e) => !isDebt(e));
  const analyzed = choices.filter((e) => e.essentialLevel);
  const totals = Object.fromEntries(
    ESSENTIAL_LEVELS.map((level) => [level, { value: 0, count: 0 }]),
  ) as Record<EssentialLevel, { value: number; count: number }>;
  for (const e of analyzed) {
    totals[e.essentialLevel!].value += e.monthlyCost;
    totals[e.essentialLevel!].count += 1;
  }
  const analyzedValue = analyzed.reduce((sum, e) => sum + e.monthlyCost, 0);

  return {
    currency,
    monthly: money(monthly),
    count: active.length,
    byCategory: pieSlices(
      [...byCategory].map(([key, e]) => ({ key, ...e })),
      { money, otherLabel: t('recurring.analytics.other') },
    ),
    byKind: pieSlices(
      [...byKind].map(([key, e]) => ({ key, ...e })),
      { money, otherLabel: t('recurring.analytics.other') },
    ),
    debts: { amount: money(debtValue), count: debtCount },
    essentials: {
      levels: ESSENTIAL_LEVELS.map((level) => ({
        level,
        label: t(`recurring.analytics.levels.${level}`),
        amount: money(totals[level].value),
        value: roundCents(totals[level].value),
        count: totals[level].count,
        percent:
          analyzedValue > 0
            ? Math.round((totals[level].value / analyzedValue) * 100)
            : 0,
      })),
      savings: money(totals.dispensable.value),
      savingsValue: roundCents(totals.dispensable.value),
      items: analyzed
        .map(
          (e): AnalyzedExpense => ({
            id: e.id,
            name: e.name,
            category: e.categoryId
              ? (categoriesById.get(e.categoryId)?.name ?? null)
              : null,
            amount: money(e.monthlyCost),
            value: e.monthlyCost,
            level: e.essentialLevel!,
            levelLabel: t(`recurring.analytics.levels.${e.essentialLevel!}`),
            reason: e.essentialReason ?? null,
          }),
        )
        .sort(
          (a, b) =>
            LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || b.value - a.value,
        ),
      pending: choices.length - analyzed.length,
    },
  };
}
