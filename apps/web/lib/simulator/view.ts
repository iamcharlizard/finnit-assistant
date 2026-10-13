import {
  monthLabel,
  monthOf,
  shiftMonth,
  shortMonthLabel,
  type DayKey,
  type MonthRef,
} from '@/lib/finance/dates';
import { formatMoney, roundCents } from '@/lib/finance/money';
import type { Localizer } from '@/lib/i18n/translator';
import type { Baseline, SimulationResult } from './scenario';
import type { ApiCashFlowBaseline } from './types';

/** What the simulator page gets from the server. */
export interface SimulatorData {
  baseline: Baseline;
  currency: string;
  monthsOfData: number;
  /** False when there are no movements and no balance to start from. */
  hasData: boolean;
  /** The month of "Hoy"; month i of a projection is this plus i. */
  startMonth: MonthRef;
}

export function buildSimulatorData(
  api: ApiCashFlowBaseline,
  today: DayKey,
): SimulatorData {
  const baseline = {
    balance: roundCents(api.currentBalance),
    income: roundCents(api.monthlyIncome),
    expenses: roundCents(api.monthlyExpenses),
  };
  return {
    baseline,
    currency: api.currency,
    monthsOfData: api.monthsOfData,
    hasData:
      baseline.balance !== 0 ||
      baseline.income !== 0 ||
      baseline.expenses !== 0,
    startMonth: monthOf(today),
  };
}

/**
 * Axis labels: "Hoy", then "Nov", "Dic", "Ene 27"… (the year only for
 * months outside the starting one's year).
 */
export function monthAxisLabels(
  start: MonthRef,
  months: number,
  { t, locale }: Localizer,
): string[] {
  return Array.from({ length: months + 1 }, (_, i) => {
    if (i === 0) return t('simulator.chart.today');
    const m = shiftMonth(start, i);
    const short = shortMonthLabel(m, locale);
    return m.year === start.year
      ? short
      : `${short} ${String(m.year).slice(2)}`;
  });
}

/** "Noviembre 2026" for month i of the projection. */
export function projectionMonthLabel(
  start: MonthRef,
  index: number,
  locale: Localizer['locale'],
): string {
  return monthLabel(shiftMonth(start, index), locale);
}

export interface ResultView {
  endBaseline: string;
  endScenario: string;
  difference: string;
  /** Whether the scenario ends above, below or equal to "Hoy". */
  tone: 'up' | 'down' | 'flat';
  baselineNegative: string;
  scenarioNegative: string;
  /** The scenario goes negative (and "Hoy" doesn't, or later). */
  scenarioWarning: boolean;
  baselineNet: string;
  scenarioNet: string;
  scenarioIncome: string;
  scenarioExpenses: string;
  endMonth: string;
}

function negativeText(
  index: number | null,
  start: MonthRef,
  { t, locale }: Localizer,
): string {
  if (index === null) return t('simulator.results.neverNegative');
  if (index === 0) return t('simulator.results.negativeToday');
  return t('simulator.results.negativeIn', {
    month: projectionMonthLabel(start, index, locale),
  });
}

export function describeResult(
  result: SimulationResult,
  data: Pick<SimulatorData, 'currency' | 'startMonth'>,
  l: Localizer,
): ResultView {
  const money = (amount: number, sign: 'negative' | 'always' = 'negative') =>
    formatMoney(amount, data.currency, l.locale, { sign });
  const diff = result.difference;
  return {
    endBaseline: money(result.baseline.at(-1)!),
    endScenario: money(result.scenario.at(-1)!),
    difference: money(diff, 'always'),
    tone: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat',
    baselineNegative: negativeText(result.baselineNegative, data.startMonth, l),
    scenarioNegative: negativeText(result.scenarioNegative, data.startMonth, l),
    scenarioWarning:
      result.scenarioNegative !== null &&
      (result.baselineNegative === null ||
        result.scenarioNegative < result.baselineNegative),
    baselineNet: money(result.baselineNet, 'always'),
    scenarioNet: money(result.scenarioNet, 'always'),
    scenarioIncome: money(result.scenarioIncome),
    scenarioExpenses: money(result.scenarioExpenses),
    endMonth: projectionMonthLabel(data.startMonth, result.months, l.locale),
  };
}
