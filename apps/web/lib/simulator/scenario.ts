import { roundCents } from '@/lib/finance/money';

/**
 * The "¿Y si…?" math, done in the browser so every change shows at once.
 * Same model as the API's cashFlowProjection and whatIfScenario: month i
 * ends at `balance + i × (income − expenses)`; on top of that a scenario
 * can change the income, add or cut monthly expenses, pay extra to debts
 * every month and spend one-time amounts in a given month.
 */

/** Where every projection starts: the API's cashFlowBaseline. */
export interface Baseline {
  balance: number;
  /** Average monthly income. */
  income: number;
  /** Average monthly expenses. */
  expenses: number;
}

export type MonthlyItemKind = 'add' | 'cut';

/** A monthly expense the scenario adds ("nuevo auto") or cuts ("cancelar gym"). */
export interface MonthlyItem {
  id: string;
  name: string;
  kind: MonthlyItemKind;
  amount: number;
}

/** A one-time expense paid in month `month` (1 = next month). */
export interface OneTimeItem {
  id: string;
  name: string;
  amount: number;
  month: number;
}

export type IncomeMode = 'amount' | 'percent';

export interface Scenario {
  incomeMode: IncomeMode;
  /** New monthly income when incomeMode is 'amount'. */
  incomeAmount: number;
  /** Change in percent when incomeMode is 'percent' (−100 … 1000). */
  incomePercent: number;
  monthly: MonthlyItem[];
  oneTime: OneTimeItem[];
  /**
   * Extra paid to debts each month. Modeled as one more expense: the
   * simulator doesn't lower the debts' balances or interest.
   */
  extraDebtPayment: number;
  /** 3–36. */
  months: number;
}

export const MIN_MONTHS = 3;
export const MAX_MONTHS = 36;
export const DEFAULT_MONTHS = 12;

/** The scenario that changes nothing: what "Restablecer" goes back to. */
export function neutralScenario(baseline: Baseline): Scenario {
  return {
    incomeMode: 'percent',
    incomeAmount: roundCents(baseline.income),
    incomePercent: 0,
    monthly: [],
    oneTime: [],
    extraDebtPayment: 0,
    months: DEFAULT_MONTHS,
  };
}

export function clampMonths(months: number): number {
  if (!Number.isFinite(months)) return DEFAULT_MONTHS;
  return Math.min(MAX_MONTHS, Math.max(MIN_MONTHS, Math.round(months)));
}

export function scenarioIncome(baseline: Baseline, scenario: Scenario): number {
  return scenario.incomeMode === 'amount'
    ? scenario.incomeAmount
    : baseline.income * (1 + scenario.incomePercent / 100);
}

export function scenarioExpenses(
  baseline: Baseline,
  scenario: Scenario,
): number {
  const items = scenario.monthly.reduce(
    (sum, item) => sum + (item.kind === 'add' ? item.amount : -item.amount),
    0,
  );
  // Cutting more than is spent can't make expenses negative.
  return Math.max(0, baseline.expenses + items) + scenario.extraDebtPayment;
}

/** Balances at today (index 0) and the end of each month (1 … months). */
export function projectBalances({
  start,
  monthlyNet,
  months,
  oneTime = [],
}: {
  start: number;
  monthlyNet: number;
  months: number;
  oneTime?: Pick<OneTimeItem, 'amount' | 'month'>[];
}): number[] {
  const balances = [start];
  let balance = start;
  for (let i = 1; i <= months; i++) {
    balance += monthlyNet;
    for (const item of oneTime) if (item.month === i) balance -= item.amount;
    balances.push(roundCents(balance));
  }
  return balances;
}

/** First index whose balance is below zero (0 = already today), or null. */
export function firstNegativeMonth(balances: number[]): number | null {
  const index = balances.findIndex((b) => b < 0);
  return index === -1 ? null : index;
}

export interface SimulationResult {
  months: number;
  baselineNet: number;
  scenarioIncome: number;
  scenarioExpenses: number;
  scenarioNet: number;
  baseline: number[];
  scenario: number[];
  /** Scenario minus baseline at the end. */
  difference: number;
  baselineNegative: number | null;
  scenarioNegative: number | null;
  /** One-time items beyond the projected months: left out. */
  outOfRange: OneTimeItem[];
}

export function simulate(
  baseline: Baseline,
  scenario: Scenario,
): SimulationResult {
  const months = clampMonths(scenario.months);
  const baselineNet = baseline.income - baseline.expenses;
  const income = scenarioIncome(baseline, scenario);
  const expenses = scenarioExpenses(baseline, scenario);
  const scenarioNet = income - expenses;
  const inRange = scenario.oneTime.filter((o) => o.month <= months);

  const base = projectBalances({
    start: baseline.balance,
    monthlyNet: baselineNet,
    months,
  });
  const next = projectBalances({
    start: baseline.balance,
    monthlyNet: scenarioNet,
    months,
    oneTime: inRange,
  });

  return {
    months,
    baselineNet: roundCents(baselineNet),
    scenarioIncome: roundCents(income),
    scenarioExpenses: roundCents(expenses),
    scenarioNet: roundCents(scenarioNet),
    baseline: base,
    scenario: next,
    difference: roundCents(next.at(-1)! - base.at(-1)!),
    baselineNegative: firstNegativeMonth(base),
    scenarioNegative: firstNegativeMonth(next),
    outOfRange: scenario.oneTime.filter((o) => o.month > months),
  };
}

/** True when the scenario changes nothing (the reset button is idle). */
export function isNeutral(baseline: Baseline, scenario: Scenario): boolean {
  return (
    scenario.monthly.length === 0 &&
    scenario.oneTime.length === 0 &&
    scenario.extraDebtPayment === 0 &&
    scenario.months === DEFAULT_MONTHS &&
    roundCents(scenarioIncome(baseline, scenario)) ===
      roundCents(baseline.income)
  );
}
