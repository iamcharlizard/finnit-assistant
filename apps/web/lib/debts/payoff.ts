import {
  monthLabel,
  monthOf,
  shiftMonth,
  type DayKey,
} from '@/lib/finance/dates';
import { DEFAULT_CURRENCY, formatMoney, roundCents } from '@/lib/finance/money';
import type { Localizer } from '@/lib/i18n/translator';
import { parseAmount } from '@/lib/new-entry/form';
import type { ApiPayoffProjection, PayoffStrategy } from './types';

/**
 * The payoff plan: Avalanche (highest rate first) against Snowball
 * (smallest balance first), each as the API projects it with the same extra
 * monthly payment.
 */
export const STRATEGIES = [
  'avalanche',
  'snowball',
] as const satisfies ReadonlyArray<PayoffStrategy>;

export const MAX_EXTRA = 9_999_999;

/** The extra payment as typed: '' is 0; null when it isn't a valid amount. */
export function parseExtraPayment(text: string): number | null {
  if (!text.trim()) return 0;
  const value = parseAmount(text);
  if (value === null || value < 0 || value > MAX_EXTRA) return null;
  return value;
}

export interface PlanStep {
  debtId: string;
  name: string;
  /** 1-based position in the plan. */
  position: number;
  months: number | null;
  /** "8 meses" / "Nunca"… */
  monthsLabel: string;
  /** "Junio 2027", or null when never paid off. */
  payoffLabel: string | null;
  interest: string;
  /** Bar length, 0–100, on a scale shared by both strategies. */
  barPercent: number;
}

export interface StrategyPlan {
  strategy: PayoffStrategy;
  /** Months until every debt is paid off; null when some never is. */
  months: number | null;
  monthsLabel: string;
  debtFreeLabel: string | null;
  interestValue: number;
  interest: string;
  steps: PlanStep[];
}

export interface PayoffComparison {
  avalanche: StrategyPlan;
  snowball: StrategyPlan;
  /** The cheaper or faster strategy, or null when they come out the same. */
  better: PayoffStrategy | null;
  /** Short explanation of the difference. */
  verdict: string;
}

const planMonths = (plan: ReadonlyArray<ApiPayoffProjection>) =>
  plan.some((p) => p.monthsToPayoff === null)
    ? null
    : Math.max(0, ...plan.map((p) => p.monthsToPayoff ?? 0));

function monthsText(months: number | null, { t }: Localizer): string {
  return months === null
    ? t('debts.plan.never')
    : t('debts.plan.months', { count: months });
}

function buildPlan(
  strategy: PayoffStrategy,
  plan: ReadonlyArray<ApiPayoffProjection>,
  scale: number,
  today: DayKey,
  l: Localizer,
): StrategyPlan {
  const { locale } = l;
  const money = (n: number) => formatMoney(n, DEFAULT_CURRENCY, locale);
  const start = monthOf(today);
  const months = planMonths(plan);
  const interestValue = roundCents(
    plan.reduce((sum, p) => sum + p.totalInterest, 0),
  );
  return {
    strategy,
    months,
    monthsLabel: monthsText(months, l),
    debtFreeLabel:
      months === null ? null : monthLabel(shiftMonth(start, months), locale),
    interestValue,
    interest: money(interestValue),
    steps: plan.map((p, i) => ({
      debtId: p.debtId,
      name: p.debtName,
      position: i + 1,
      months: p.monthsToPayoff,
      monthsLabel: monthsText(p.monthsToPayoff, l),
      payoffLabel:
        p.monthsToPayoff === null
          ? null
          : monthLabel(shiftMonth(start, p.monthsToPayoff), locale),
      interest: money(p.totalInterest),
      barPercent:
        p.monthsToPayoff === null
          ? 100
          : scale > 0
            ? Math.max(2, Math.round((p.monthsToPayoff / scale) * 100))
            : 0,
    })),
  };
}

export function buildPayoffComparison(
  plans: Record<PayoffStrategy, ApiPayoffProjection[]>,
  { today }: { today: DayKey },
  l: Localizer,
): PayoffComparison {
  const { t, locale } = l;
  // One scale for both columns, so their bars compare.
  const scale = Math.max(
    0,
    ...[...plans.avalanche, ...plans.snowball].map(
      (p) => p.monthsToPayoff ?? 0,
    ),
  );
  const avalanche = buildPlan('avalanche', plans.avalanche, scale, today, l);
  const snowball = buildPlan('snowball', plans.snowball, scale, today, l);

  const saved = roundCents(snowball.interestValue - avalanche.interestValue);
  const name = (s: PayoffStrategy) => t(`debts.plan.strategies.${s}.name`);
  let better: PayoffStrategy | null = null;
  let verdict: string;
  if (avalanche.months === null || snowball.months === null) {
    better = null;
    verdict = t('debts.plan.verdict.never');
  } else if (Math.abs(saved) >= 1) {
    better = saved > 0 ? 'avalanche' : 'snowball';
    verdict = t('debts.plan.verdict.saves', {
      strategy: name(better),
      amount: formatMoney(Math.abs(saved), DEFAULT_CURRENCY, locale),
    });
  } else if (avalanche.months !== snowball.months) {
    better = avalanche.months < snowball.months ? 'avalanche' : 'snowball';
    verdict = t('debts.plan.verdict.faster', {
      strategy: name(better),
      count: Math.abs(avalanche.months - snowball.months),
    });
  } else {
    verdict = t('debts.plan.verdict.same');
  }
  return { avalanche, snowball, better, verdict };
}
