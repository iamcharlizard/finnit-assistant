import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { GraphqlRequestError } from '@/lib/graphql/client';
import { testLocalizer } from '@/lib/i18n/testing';
import {
  ADD_CONTRIBUTION_MUTATION,
  CONTRIBUTIONS_QUERY,
  CREATE_GOAL_MUTATION,
  DELETE_GOAL_MUTATION,
  REMOVE_CONTRIBUTION_MUTATION,
  UPDATE_GOAL_MUTATION,
  deleteGoalWithContributions,
  goalErrorMessage,
  hasContributionsError,
  projectionsQuery,
  saveGoal,
} from './api';
import {
  buildContributionInput,
  buildCreateGoalInput,
  buildUpdateGoalInput,
  formOfGoal,
  initialContribution,
  newGoalForm,
  parseMonthlyContribution,
  validateContributionForm,
  validateGoalForm,
} from './form';
import {
  goalStatus,
  monthsUntil,
  neededMonthly,
  progressPercent,
} from './status';
import type {
  ApiGoal,
  ApiGoalContribution,
  ApiGoalProjection,
  ApiGoalRecommendations,
} from './types';
import {
  buildGoalCard,
  buildGoalDetail,
  buildGoalsView,
  buildProjectionView,
  goalsHref,
  parseGoalParam,
} from './view';

const es = testLocalizer('es');
const en = testLocalizer('en');
const TODAY = '2026-10-13';

const goal = (overrides: Partial<ApiGoal> = {}): ApiGoal => ({
  id: 'goal-1',
  name: 'Viaje a Oaxaca',
  targetAmount: 20000,
  currentAmount: 5000,
  currency: 'MXN',
  dueDate: '2027-04-30T00:00:00.000Z',
  createdAt: '2026-09-01T12:00:00.000Z',
  ...overrides,
});

const projection = (
  overrides: Partial<ApiGoalProjection> = {},
): ApiGoalProjection => ({
  goalId: 'goal-1',
  monthlyContribution: 3000,
  monthsRemaining: 5,
  completionDate: '2027-03-13T00:00:00.000Z',
  ...overrides,
});

const recommendations = (
  overrides: Partial<ApiGoalRecommendations> = {},
): ApiGoalRecommendations => ({
  totalGoalsAmount: 20000,
  totalSavedAmount: 5000,
  averageProgress: 25,
  recommendedMonthlyContribution: 1250,
  goalsDueSoon: [],
  goalsAtRisk: [],
  ...overrides,
});

/** Records the documents run, answering with `answers` in order. */
function recorder(answers: unknown[] = []) {
  const calls: { query: string; variables?: Record<string, unknown> }[] = [];
  const run = async <T>(query: string, variables?: Record<string, unknown>) => {
    calls.push({ query, variables });
    const answer = answers.shift();
    if (answer instanceof Error) throw answer;
    return answer as T;
  };
  return { calls, run };
}

describe('goalStatus', () => {
  const base = { current: 5000, target: 20000, today: TODAY };

  it('is reached once the saved amount covers the target', () => {
    assert.equal(
      goalStatus({
        ...base,
        current: 20000,
        dueDay: '2026-01-01',
        completionDay: null,
      }),
      'reached',
    );
  });

  it('compares the projection with the due date', () => {
    assert.equal(
      goalStatus({
        ...base,
        dueDay: '2027-04-30',
        completionDay: '2027-03-13',
      }),
      'onTrack',
    );
    assert.equal(
      goalStatus({
        ...base,
        dueDay: '2027-04-30',
        completionDay: '2027-04-30',
      }),
      'onTrack',
    );
    assert.equal(
      goalStatus({
        ...base,
        dueDay: '2027-04-30',
        completionDay: '2027-06-13',
      }),
      'behind',
    );
  });

  it('is behind without a projection, overdue after the due date, open without one', () => {
    assert.equal(
      goalStatus({ ...base, dueDay: '2027-04-30', completionDay: null }),
      'behind',
    );
    assert.equal(
      goalStatus({ ...base, dueDay: '2026-10-12', completionDay: null }),
      'overdue',
    );
    assert.equal(
      goalStatus({ ...base, dueDay: null, completionDay: '2027-01-01' }),
      'noDueDate',
    );
  });
});

describe('monthsUntil / neededMonthly', () => {
  it('counts whole months that fit before the due date', () => {
    assert.equal(monthsUntil(TODAY, '2027-04-13'), 6);
    assert.equal(monthsUntil(TODAY, '2027-04-12'), 5);
    assert.equal(monthsUntil(TODAY, '2026-10-31'), 0);
  });

  it('spreads what remains over those months, rounding up to cents', () => {
    assert.equal(
      neededMonthly({ remaining: 15000, dueDay: '2027-04-13', today: TODAY }),
      2500,
    );
    assert.equal(
      neededMonthly({ remaining: 100, dueDay: '2027-01-13', today: TODAY }),
      33.34,
    );
    // Less than a month away: all of it now.
    assert.equal(
      neededMonthly({ remaining: 900, dueDay: '2026-10-31', today: TODAY }),
      900,
    );
    assert.equal(
      neededMonthly({ remaining: 900, dueDay: null, today: TODAY }),
      null,
    );
    assert.equal(
      neededMonthly({ remaining: 900, dueDay: '2026-10-01', today: TODAY }),
      null,
    );
    assert.equal(
      neededMonthly({ remaining: 0, dueDay: '2027-10-01', today: TODAY }),
      null,
    );
  });

  it('gives a percentage that may pass 100', () => {
    assert.equal(progressPercent(5000, 20000), 25);
    assert.equal(progressPercent(25000, 20000), 125);
    assert.equal(progressPercent(10, 0), 0);
  });
});

describe('buildGoalCard', () => {
  it('shows progress, deadline, days left and the projected month', () => {
    const card = buildGoalCard(goal(), projection(), TODAY, es);
    assert.equal(card.saved, '$5,000.00');
    assert.equal(card.target, '$20,000.00');
    assert.equal(card.remaining, '$15,000.00');
    assert.equal(card.percent, 25);
    assert.equal(card.status, 'onTrack');
    assert.equal(card.dueLabel, 'Vence el 30 de abril de 2027');
    assert.equal(card.daysLabel, 'Faltan 199 días');
    assert.equal(card.projectionLabel, 'Llegarías en Marzo 2027');
  });

  it('speaks English too', () => {
    const card = buildGoalCard(goal(), projection(), TODAY, en);
    assert.equal(card.dueLabel, 'Due April 30, 2027');
    assert.equal(card.daysLabel, '199 days left');
    assert.equal(card.projectionLabel, "You'd get there in March 2027");
  });

  it('handles goals without date, overdue, reached and without projection', () => {
    const open = buildGoalCard(
      goal({ dueDate: null }),
      projection(),
      TODAY,
      es,
    );
    assert.equal(open.dueLabel, 'Sin fecha límite');
    assert.equal(open.daysLabel, null);
    assert.equal(open.status, 'noDueDate');

    const late = buildGoalCard(
      goal({ dueDate: '2026-10-10T00:00:00.000Z' }),
      projection({ completionDate: null, monthsRemaining: null }),
      TODAY,
      es,
    );
    assert.equal(late.status, 'overdue');
    assert.equal(late.daysLabel, 'Venció hace 3 días');
    assert.equal(
      late.projectionLabel,
      'Sin aportaciones recientes para proyectar',
    );

    const done = buildGoalCard(goal({ currentAmount: 20000 }), null, TODAY, es);
    assert.equal(done.status, 'reached');
    assert.equal(done.daysLabel, null);
    assert.equal(done.projectionLabel, '¡Meta alcanzada!');

    const today = buildGoalCard(
      goal({ dueDate: `${TODAY}T00:00:00.000Z` }),
      null,
      TODAY,
      en,
    );
    assert.equal(today.daysLabel, 'Due today');
  });
});

describe('buildProjectionView', () => {
  it('says when the goal is reached and how that compares with the due date', () => {
    const view = buildProjectionView(goal(), projection(), TODAY, es);
    assert.equal(view.headline, 'Llegarías en Marzo 2027 (5 meses)');
    assert.equal(
      view.detail,
      'Antes de tu fecha límite (30 de abril de 2027).',
    );
    assert.equal(view.status, 'onTrack');

    const slow = buildProjectionView(
      goal(),
      projection({
        monthlyContribution: 1000,
        monthsRemaining: 15,
        completionDate: '2028-01-13T00:00:00.000Z',
      }),
      TODAY,
      en,
    );
    assert.equal(slow.headline, "You'd get there in January 2028 (15 months)");
    assert.equal(slow.detail, 'After your due date (April 30, 2027).');
    assert.equal(slow.status, 'behind');
  });

  it('explains a zero monthly saving', () => {
    const view = buildProjectionView(
      goal({ dueDate: null }),
      projection({
        monthlyContribution: 0,
        monthsRemaining: null,
        completionDate: null,
      }),
      TODAY,
      es,
    );
    assert.equal(view.headline, 'Sin aportar cada mes no llegarías a la meta.');
    assert.equal(view.detail, null);
  });
});

describe('buildGoalsView', () => {
  const contributions: ApiGoalContribution[] = [
    {
      id: 'c2',
      goalId: 'goal-1',
      amount: 3000,
      date: '2026-10-01T00:00:00.000Z',
      transactionId: 'tx-1',
    },
    {
      id: 'c1',
      goalId: 'goal-1',
      amount: 2000,
      date: '2026-09-01T00:00:00.000Z',
      transactionId: null,
    },
  ];

  it('puts unfinished goals first by due date and totals one currency', () => {
    const view = buildGoalsView(
      {
        goals: [
          goal({ id: 'done', name: 'Listo', currentAmount: 20000 }),
          goal({
            id: 'late',
            name: 'Tarde',
            dueDate: '2028-01-01T00:00:00.000Z',
          }),
          goal({
            id: 'soon',
            name: 'Pronto',
            dueDate: '2026-12-01T00:00:00.000Z',
          }),
          goal({ id: 'open', name: 'Abierta', dueDate: null }),
        ],
        projections: {},
        recommendations: recommendations({
          totalGoalsAmount: 80000,
          totalSavedAmount: 35000,
          averageProgress: 43.75,
          recommendedMonthlyContribution: 3750,
          goalsDueSoon: [],
          goalsAtRisk: [{ id: 'soon', name: 'Pronto' }],
        }),
        detail: null,
      },
      TODAY,
      es,
    );
    assert.deepEqual(
      view.cards.map((c) => c.id),
      ['soon', 'late', 'open', 'done'],
    );
    assert.deepEqual(view.summary, {
      saved: '$35,000.00',
      target: '$80,000.00',
      averageProgress: '44 %',
      recommendedMonthly: '$3,750.00',
      count: 4,
    });
    assert.deepEqual(view.atRisk, ['Pronto']);
    assert.equal(view.detail, null);
  });

  it('leaves totals out when goals mix currencies', () => {
    const view = buildGoalsView(
      {
        goals: [goal(), goal({ id: 'usd', currency: 'USD' })],
        projections: {},
        recommendations: recommendations(),
        detail: null,
      },
      TODAY,
      es,
    );
    assert.equal(view.summary, null);
  });

  it('builds the open goal with its contributions and tips', () => {
    const view = buildGoalsView(
      {
        goals: [goal()],
        projections: { 'goal-1': projection() },
        recommendations: recommendations(),
        detail: {
          goalId: 'goal-1',
          contributions,
          recommendations: recommendations({
            goalsAtRisk: [{ id: 'goal-1', name: 'x' }],
          }),
        },
      },
      TODAY,
      es,
    );
    const detail = view.detail!;
    assert.deepEqual(detail.contributions, [
      {
        id: 'c2',
        amount: '$3,000.00',
        dateLabel: '1 de octubre',
        linked: true,
      },
      {
        id: 'c1',
        amount: '$2,000.00',
        dateLabel: '1 de septiembre',
        linked: false,
      },
    ]);
    assert.equal(detail.monthlyText, '3000');
    assert.equal(detail.averageMonthly, '$3,000.00');
    // 15,000 over the 6 whole months until Apr 30.
    assert.deepEqual(detail.needed, {
      amount: 2500,
      text: '2500',
      label: 'Para llegar a tiempo, aparta $2,500.00 al mes.',
    });
    assert.equal(
      detail.twelveMonths,
      'Para completarla en 12 meses, aparta $1,250.00 al mes.',
    );
    assert.equal(detail.atRisk, true);
    assert.equal(detail.dueSoon, false);
    assert.equal(detail.canContribute, true);
  });

  it('closes the contributions of a reached goal', () => {
    const detail = buildGoalDetail(
      {
        goal: goal({ currentAmount: 20000 }),
        projection: projection({ monthsRemaining: 0, completionDate: null }),
        contributions: [],
        recommendations: recommendations({ recommendedMonthlyContribution: 0 }),
      },
      TODAY,
      es,
    );
    assert.equal(detail.canContribute, false);
    assert.equal(detail.needed, null);
    assert.equal(detail.twelveMonths, null);
    assert.equal(detail.projection.headline, 'Ya alcanzaste esta meta.');
  });

  it('opens only goals of the user from ?goal=', () => {
    const goals = [{ id: 'goal-1' }];
    assert.equal(parseGoalParam('goal-1', goals), 'goal-1');
    assert.equal(parseGoalParam('other', goals), null);
    assert.equal(parseGoalParam(['goal-1'], goals), null);
    assert.equal(parseGoalParam(undefined, goals), null);
    assert.equal(goalsHref('a b'), '/planning/goals?goal=a%20b');
    assert.equal(goalsHref(), '/planning/goals');
  });
});

describe('goal form', () => {
  it('validates name, target, due date and the starting amount', () => {
    assert.deepEqual(validateGoalForm(newGoalForm(), { today: TODAY }), {
      name: 'nameRequired',
      targetAmount: 'amountRequired',
    });
    assert.deepEqual(
      validateGoalForm(
        {
          name: 'x'.repeat(101),
          targetAmount: '0',
          currency: 'MXN',
          dueDate: '2026-10-12',
          initialAmount: 'abc',
        },
        { today: TODAY },
      ),
      {
        name: 'nameTooLong',
        targetAmount: 'amountInvalid',
        dueDate: 'dueDateInPast',
        initialAmount: 'initialInvalid',
      },
    );
  });

  it('keeps a past due date the goal already had', () => {
    const initial = formOfGoal(goal({ dueDate: '2026-09-30T00:00:00.000Z' }));
    assert.deepEqual(validateGoalForm(initial, { today: TODAY, initial }), {});
    assert.deepEqual(
      validateGoalForm(
        { ...initial, dueDate: '2026-10-01' },
        { today: TODAY, initial },
      ),
      { dueDate: 'dueDateInPast' },
    );
  });

  it('builds the create input and the first contribution', () => {
    const form = {
      name: '  Fondo de emergencia ',
      targetAmount: '$30,000',
      currency: 'MXN',
      dueDate: '2027-06-30',
      initialAmount: '1,500.50',
    };
    assert.deepEqual(buildCreateGoalInput(form), {
      name: 'Fondo de emergencia',
      targetAmount: 30000,
      currency: 'MXN',
      dueDate: '2027-06-30T00:00:00.000Z',
    });
    assert.deepEqual(buildCreateGoalInput({ ...form, dueDate: '' }), {
      name: 'Fondo de emergencia',
      targetAmount: 30000,
      currency: 'MXN',
    });
    assert.deepEqual(initialContribution(form, 'g', TODAY), {
      goalId: 'g',
      amount: 1500.5,
      date: '2026-10-13T00:00:00.000Z',
    });
    assert.equal(
      initialContribution({ ...form, initialAmount: '' }, 'g', TODAY),
      null,
    );
  });

  it('sends only what changed, null to clear the due date', () => {
    const initial = formOfGoal(goal());
    assert.equal(initial.targetAmount, '20000');
    assert.equal(initial.dueDate, '2027-04-30');
    assert.equal(buildUpdateGoalInput(initial, initial), null);
    assert.deepEqual(
      buildUpdateGoalInput(
        { ...initial, name: 'Oaxaca', targetAmount: '25,000', dueDate: '' },
        initial,
      ),
      { name: 'Oaxaca', targetAmount: 25000, dueDate: null },
    );
    assert.deepEqual(
      buildUpdateGoalInput({ ...initial, dueDate: '2027-05-01' }, initial),
      {
        dueDate: '2027-05-01T00:00:00.000Z',
      },
    );
  });

  it('validates contributions: positive amount, no future date', () => {
    assert.deepEqual(
      validateContributionForm({ amount: '', date: '' }, TODAY),
      {
        amount: 'amountRequired',
        date: 'dateRequired',
      },
    );
    assert.deepEqual(
      validateContributionForm({ amount: '500', date: '2026-10-14' }, TODAY),
      {
        date: 'dateInFuture',
      },
    );
    assert.deepEqual(
      buildContributionInput('g', { amount: '500', date: TODAY }),
      {
        goalId: 'g',
        amount: 500,
        date: '2026-10-13T00:00:00.000Z',
      },
    );
  });

  it('reads the monthly contribution box', () => {
    assert.equal(parseMonthlyContribution('2,500'), 2500);
    assert.equal(parseMonthlyContribution('0'), 0);
    assert.equal(parseMonthlyContribution(''), null);
    assert.equal(parseMonthlyContribution('-5'), null);
    assert.equal(parseMonthlyContribution('9999999999'), null);
  });
});

describe('goals api', () => {
  const form = {
    name: 'Auto',
    targetAmount: '100000',
    currency: 'MXN',
    dueDate: '',
    initialAmount: '2000',
  };

  it('creates the goal and then its first contribution', async () => {
    const { calls, run } = recorder([
      { createGoal: { id: 'new' } },
      { addGoalContribution: { id: 'c' } },
    ]);
    const result = await saveGoal(form, { mode: 'create' }, run, TODAY);
    assert.deepEqual(result, { changed: true, goalId: 'new' });
    assert.equal(calls[0]!.query, CREATE_GOAL_MUTATION);
    assert.equal(calls[1]!.query, ADD_CONTRIBUTION_MUTATION);
    assert.deepEqual(calls[1]!.variables, {
      input: { goalId: 'new', amount: 2000, date: '2026-10-13T00:00:00.000Z' },
    });
  });

  it('reports a failed first contribution without losing the goal', async () => {
    const failure = new GraphqlRequestError(
      'boom',
      'INTERNAL_SERVER_ERROR',
      true,
    );
    const { run } = recorder([{ createGoal: { id: 'new' } }, failure]);
    const result = await saveGoal(form, { mode: 'create' }, run, TODAY);
    assert.equal(result.goalId, 'new');
    assert.equal(result.initialFailed, failure);
  });

  it('skips the update when nothing changed', async () => {
    const initial = formOfGoal(goal());
    const { calls, run } = recorder([{ updateGoal: { id: 'goal-1' } }]);
    assert.deepEqual(
      await saveGoal(
        initial,
        { mode: 'edit', id: 'goal-1', initial },
        run,
        TODAY,
      ),
      {
        changed: false,
        goalId: 'goal-1',
      },
    );
    assert.equal(calls.length, 0);
    await saveGoal(
      { ...initial, name: 'Otro' },
      { mode: 'edit', id: 'goal-1', initial },
      run,
      TODAY,
    );
    assert.deepEqual(calls[0], {
      query: UPDATE_GOAL_MUTATION,
      variables: { id: 'goal-1', input: { name: 'Otro' } },
    });
  });

  it('removes every contribution before deleting the goal', async () => {
    const { calls, run } = recorder([
      { goalContributions: [{ id: 'c1' }, { id: 'c2' }] },
      true,
      true,
      true,
    ]);
    await deleteGoalWithContributions('goal-1', run);
    assert.deepEqual(
      calls.map((c) => [c.query, c.variables]),
      [
        [CONTRIBUTIONS_QUERY, { goalId: 'goal-1' }],
        [REMOVE_CONTRIBUTION_MUTATION, { id: 'c1' }],
        [REMOVE_CONTRIBUTION_MUTATION, { id: 'c2' }],
        [DELETE_GOAL_MUTATION, { id: 'goal-1' }],
      ],
    );
  });

  it('aliases one projection per goal, plus the open goal', () => {
    assert.equal(
      projectionsQuery(2, true),
      'query GoalProjections($g0: ID!, $g1: ID!, $detail: ID!) {\n' +
        '  p0: goalProjection(goalId: $g0) { goalId monthlyContribution monthsRemaining completionDate }\n' +
        '  p1: goalProjection(goalId: $g1) { goalId monthlyContribution monthsRemaining completionDate }\n' +
        '  contributions: goalContributions(goalId: $detail) { id goalId amount date transactionId }\n' +
        '  detailRecommendations: goalRecommendations(goalId: $detail) { totalGoalsAmount totalSavedAmount averageProgress recommendedMonthlyContribution goalsDueSoon { id name } goalsAtRisk { id name } }\n' +
        '}',
    );
    assert.ok(!projectionsQuery(1, false).includes('$detail'));
  });

  it('translates the API errors', () => {
    const t = es.t;
    const err = (message: string) =>
      new GraphqlRequestError(message, 'X', true);
    assert.equal(
      goalErrorMessage(err('A goal with this name already exists'), t),
      'Ya tienes una meta con ese nombre.',
    );
    assert.equal(
      goalErrorMessage(err('Goal has already been reached'), t),
      'Esta meta ya se alcanzó; sube el monto meta para seguir aportando.',
    );
    assert.equal(
      goalErrorMessage(err('Goal not found'), t),
      'No encontramos esa meta.',
    );
    assert.equal(
      goalErrorMessage(new GraphqlRequestError('x', 'NETWORK_ERROR'), t),
      'No pudimos conectar con Finnit. Revisa tu conexión.',
    );
    assert.ok(
      hasContributionsError(
        err('Cannot delete goal with existing contributions'),
      ),
    );
    assert.ok(!hasContributionsError(err('Goal not found')));
  });
});
