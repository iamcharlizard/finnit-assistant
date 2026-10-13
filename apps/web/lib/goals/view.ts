import {
  dayKeyOf,
  longDate,
  monthLabel,
  monthOf,
  type DayKey,
} from '@/lib/finance/dates';
import { DEFAULT_CURRENCY, formatMoney, roundCents } from '@/lib/finance/money';
import type { Localizer } from '@/lib/i18n/translator';
import { amountText } from './form';
import {
  daysLeft,
  goalStatus,
  neededMonthly,
  progressPercent,
  type GoalStatus,
} from './status';
import type {
  ApiGoal,
  ApiGoalContribution,
  ApiGoalProjection,
  ApiGoalRecommendations,
} from './types';

/** What the goals screen shows, built on the server from the API's data. */

export interface GoalCardView {
  id: string;
  name: string;
  goal: ApiGoal;
  saved: string;
  target: string;
  remaining: string;
  /** Progress, may pass 100. */
  percent: number;
  status: GoalStatus;
  dueLabel: string;
  /** "Faltan 79 días", "Vence hoy", "Venció hace 3 días"; null without due date or once reached. */
  daysLabel: string | null;
  projectionLabel: string;
}

export interface ProjectionView {
  status: GoalStatus;
  headline: string;
  detail: string | null;
}

export interface ContributionItem {
  id: string;
  amount: string;
  dateLabel: string;
  /** Came from a movement (transactionId). */
  linked: boolean;
}

export interface GoalDetailView {
  card: GoalCardView;
  contributions: ContributionItem[];
  /** The API's projection at the average monthly saving. */
  apiProjection: ApiGoalProjection;
  projection: ProjectionView;
  /** The projection's monthly amount, as the input starts. */
  monthlyText: string;
  /** Average of the last 3 months of contributions, formatted. */
  averageMonthly: string;
  /** The monthly saving that reaches the target on time; null when n/a. */
  needed: { amount: number; text: string; label: string } | null;
  /** Remaining spread over 12 months (goalRecommendations); null when reached. */
  twelveMonths: string | null;
  dueSoon: boolean;
  atRisk: boolean;
  canContribute: boolean;
}

export interface GoalsSummary {
  saved: string;
  target: string;
  averageProgress: string;
  recommendedMonthly: string;
  count: number;
}

export interface GoalsScreenView {
  today: DayKey;
  currency: string;
  cards: GoalCardView[];
  /** Totals across goals; null when goals use more than one currency. */
  summary: GoalsSummary | null;
  dueSoon: string[];
  atRisk: string[];
  detail: GoalDetailView | null;
}

const completionDayOf = (projection: ApiGoalProjection | null) =>
  projection?.completionDate ? dayKeyOf(projection.completionDate) : null;

function statusOf(
  goal: ApiGoal,
  projection: ApiGoalProjection | null,
  today: DayKey,
): GoalStatus {
  return goalStatus({
    current: goal.currentAmount,
    target: goal.targetAmount,
    dueDay: goal.dueDate ? dayKeyOf(goal.dueDate) : null,
    completionDay: completionDayOf(projection),
    today,
  });
}

function daysLabel(
  goal: ApiGoal,
  status: GoalStatus,
  today: DayKey,
  { t }: Localizer,
): string | null {
  if (!goal.dueDate || status === 'reached') return null;
  const days = daysLeft(dayKeyOf(goal.dueDate), today);
  if (days === 0) return t('goals.card.dueToday');
  if (days > 0) return t('goals.card.daysLeft', { count: days });
  return t('goals.card.daysOverdue', { count: -days });
}

export function buildGoalCard(
  goal: ApiGoal,
  projection: ApiGoalProjection | null,
  today: DayKey,
  l: Localizer,
): GoalCardView {
  const { t, locale } = l;
  const status = statusOf(goal, projection, today);
  const money = (amount: number) => formatMoney(amount, goal.currency, locale);
  const completion = completionDayOf(projection);
  const projectionLabel =
    status === 'reached'
      ? t('goals.card.reached')
      : completion
        ? t('goals.card.projection', {
            month: monthLabel(monthOf(completion), locale),
          })
        : t('goals.card.noProjection');

  return {
    id: goal.id,
    name: goal.name,
    goal,
    saved: money(goal.currentAmount),
    target: money(goal.targetAmount),
    remaining: money(Math.max(0, goal.targetAmount - goal.currentAmount)),
    percent: progressPercent(goal.currentAmount, goal.targetAmount),
    status,
    dueLabel: goal.dueDate
      ? t('goals.card.due', {
          date: longDate(dayKeyOf(goal.dueDate), today, locale),
        })
      : t('goals.card.noDueDate'),
    daysLabel: daysLabel(goal, status, today, l),
    projectionLabel,
  };
}

/** The projection box: when the goal would be reached saving `projection.monthlyContribution`. */
export function buildProjectionView(
  goal: ApiGoal,
  projection: ApiGoalProjection,
  today: DayKey,
  { t, locale }: Localizer,
): ProjectionView {
  const status = statusOf(goal, projection, today);
  if (status === 'reached') {
    return { status, headline: t('goals.projection.reached'), detail: null };
  }
  const completion = completionDayOf(projection);
  const due = goal.dueDate ? dayKeyOf(goal.dueDate) : null;
  const dueText = due ? longDate(due, today, locale) : '';
  const detail =
    status === 'overdue'
      ? t('goals.projection.overdue', { date: dueText })
      : status === 'noDueDate'
        ? null
        : t(
            status === 'onTrack'
              ? 'goals.projection.onTrack'
              : 'goals.projection.behind',
            { date: dueText },
          );
  if (!completion || projection.monthsRemaining == null) {
    return { status, headline: t('goals.projection.none'), detail };
  }
  return {
    status,
    headline: t('goals.projection.result', {
      month: monthLabel(monthOf(completion), locale),
      count: projection.monthsRemaining,
    }),
    detail,
  };
}

/** Unfinished goals first (soonest due date first), reached ones last. */
function byPriority(a: GoalCardView, b: GoalCardView): number {
  const reached =
    Number(a.status === 'reached') - Number(b.status === 'reached');
  if (reached !== 0) return reached;
  const dueA = a.goal.dueDate ?? '9999';
  const dueB = b.goal.dueDate ?? '9999';
  return dueA < dueB ? -1 : dueA > dueB ? 1 : 0;
}

export function buildGoalDetail(
  data: {
    goal: ApiGoal;
    projection: ApiGoalProjection;
    contributions: ApiGoalContribution[];
    recommendations: ApiGoalRecommendations;
  },
  today: DayKey,
  l: Localizer,
): GoalDetailView {
  const { goal, projection, recommendations } = data;
  const { t, locale } = l;
  const card = buildGoalCard(goal, projection, today, l);
  const remaining = roundCents(goal.targetAmount - goal.currentAmount);
  const neededAmount = neededMonthly({
    remaining,
    dueDay: goal.dueDate ? dayKeyOf(goal.dueDate) : null,
    today,
  });
  return {
    card,
    contributions: data.contributions.map((c) => ({
      id: c.id,
      amount: formatMoney(c.amount, goal.currency, locale),
      dateLabel: longDate(dayKeyOf(c.date), today, locale),
      linked: Boolean(c.transactionId),
    })),
    apiProjection: projection,
    projection: buildProjectionView(goal, projection, today, l),
    monthlyText: amountText(projection.monthlyContribution),
    averageMonthly: formatMoney(
      projection.monthlyContribution,
      goal.currency,
      locale,
    ),
    needed:
      neededAmount === null
        ? null
        : {
            amount: neededAmount,
            text: amountText(neededAmount),
            label: t('goals.recommendations.needed', {
              amount: formatMoney(neededAmount, goal.currency, locale),
            }),
          },
    twelveMonths:
      remaining > 0
        ? t('goals.recommendations.twelveMonths', {
            amount: formatMoney(
              recommendations.recommendedMonthlyContribution,
              goal.currency,
              locale,
            ),
          })
        : null,
    dueSoon: recommendations.goalsDueSoon.some((g) => g.id === goal.id),
    atRisk: recommendations.goalsAtRisk.some((g) => g.id === goal.id),
    canContribute: remaining > 0,
  };
}

export function buildGoalsView(
  data: {
    goals: ApiGoal[];
    /** By goal id; missing when the projection couldn't be loaded. */
    projections: Record<string, ApiGoalProjection | undefined>;
    recommendations: ApiGoalRecommendations;
    detail: {
      goalId: string;
      contributions: ApiGoalContribution[];
      recommendations: ApiGoalRecommendations;
    } | null;
  },
  today: DayKey,
  l: Localizer,
): GoalsScreenView {
  const { locale } = l;
  const cards = data.goals
    .map((goal) =>
      buildGoalCard(goal, data.projections[goal.id] ?? null, today, l),
    )
    .sort(byPriority);
  const currencies = [...new Set(data.goals.map((g) => g.currency))];
  const currency = currencies[0] ?? DEFAULT_CURRENCY;
  const r = data.recommendations;
  const money = (amount: number) => formatMoney(amount, currency, locale);
  const summary: GoalsSummary | null =
    currencies.length === 1
      ? {
          saved: money(r.totalSavedAmount),
          target: money(r.totalGoalsAmount),
          averageProgress: l.t('goals.summary.percent', {
            value: Math.round(r.averageProgress),
          }),
          recommendedMonthly: money(r.recommendedMonthlyContribution),
          count: data.goals.length,
        }
      : null;

  const detailGoal = data.detail
    ? data.goals.find((g) => g.id === data.detail!.goalId)
    : undefined;
  const detailProjection = detailGoal
    ? data.projections[detailGoal.id]
    : undefined;

  return {
    today,
    currency,
    cards,
    summary,
    dueSoon: r.goalsDueSoon.map((g) => g.name),
    atRisk: r.goalsAtRisk.map((g) => g.name),
    detail:
      data.detail && detailGoal && detailProjection
        ? buildGoalDetail(
            {
              goal: detailGoal,
              projection: detailProjection,
              contributions: data.detail.contributions,
              recommendations: data.detail.recommendations,
            },
            today,
            l,
          )
        : null,
  };
}

/** The goal a `?goal=` param names, if it is one of the user's. */
export function parseGoalParam(
  value: string | string[] | undefined,
  goals: Pick<ApiGoal, 'id'>[],
): string | null {
  if (typeof value !== 'string') return null;
  return goals.some((g) => g.id === value) ? value : null;
}

export function goalsHref(goalId?: string | null): string {
  return goalId
    ? `/planning/goals?goal=${encodeURIComponent(goalId)}`
    : '/planning/goals';
}
