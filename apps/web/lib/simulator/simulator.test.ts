import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { formatMoney } from '@/lib/finance/money';
import { testLocalizer } from '@/lib/i18n/testing';
import { chartGeometry, compactAmount, indexAt, labeledIndexes } from './chart';
import {
  parseMoneyField,
  parsePercentField,
  toMonthlyItem,
  toOneTimeItem,
  validateMonthlyDraft,
  validateOneTimeDraft,
} from './form';
import {
  clampMonths,
  firstNegativeMonth,
  isNeutral,
  neutralScenario,
  projectBalances,
  scenarioExpenses,
  scenarioIncome,
  simulate,
  type Baseline,
  type Scenario,
} from './scenario';
import {
  buildSimulatorData,
  describeResult,
  monthAxisLabels,
  projectionMonthLabel,
} from './view';

const es = testLocalizer('es');
const en = testLocalizer('en');

const baseline: Baseline = { balance: 10000, income: 30000, expenses: 25000 };
const scenario = (overrides: Partial<Scenario> = {}): Scenario => ({
  ...neutralScenario(baseline),
  ...overrides,
});

describe('scenario math', () => {
  it('matches the API projection without changes (balance + i × net)', () => {
    const result = simulate(baseline, scenario({ months: 3 }));
    assert.deepEqual(result.baseline, [10000, 15000, 20000, 25000]);
    assert.deepEqual(result.scenario, result.baseline);
    assert.equal(result.difference, 0);
    assert.ok(isNeutral(baseline, scenario()));
  });

  it('changes income by amount or percent', () => {
    assert.equal(
      scenarioIncome(baseline, scenario({ incomePercent: 10 })),
      33000,
    );
    assert.equal(
      scenarioIncome(baseline, scenario({ incomePercent: -100 })),
      0,
    );
    assert.equal(
      scenarioIncome(
        baseline,
        scenario({ incomeMode: 'amount', incomeAmount: 40000 }),
      ),
      40000,
    );
  });

  it('adds and cuts monthly expenses, plus the extra debt payment', () => {
    const s = scenario({
      monthly: [
        { id: 'a', name: 'Nuevo auto', kind: 'add', amount: 8000 },
        { id: 'b', name: 'Gym', kind: 'cut', amount: 1000 },
      ],
      extraDebtPayment: 2000,
    });
    assert.equal(scenarioExpenses(baseline, s), 34000);
    // Cuts never take expenses below zero.
    assert.equal(
      scenarioExpenses(
        baseline,
        scenario({
          monthly: [{ id: 'c', name: '', kind: 'cut', amount: 99999 }],
        }),
      ),
      0,
    );
  });

  it('charges one-time expenses in their month and ignores those beyond the period', () => {
    const result = simulate(
      baseline,
      scenario({
        months: 3,
        oneTime: [
          { id: 'trip', name: 'Viaje', amount: 12000, month: 2 },
          { id: 'far', name: 'Lejos', amount: 1, month: 10 },
        ],
      }),
    );
    assert.deepEqual(result.scenario, [10000, 15000, 8000, 13000]);
    assert.equal(result.difference, -12000);
    assert.deepEqual(
      result.outOfRange.map((o) => o.id),
      ['far'],
    );
  });

  it('finds the month the balance goes negative', () => {
    const result = simulate(
      baseline,
      scenario({
        months: 6,
        monthly: [{ id: 'car', name: 'Nuevo auto', kind: 'add', amount: 8000 }],
      }),
    );
    // Net −3,000 a month from 10,000: below zero at month 4.
    assert.deepEqual(
      result.scenario,
      [10000, 7000, 4000, 1000, -2000, -5000, -8000],
    );
    assert.equal(result.scenarioNegative, 4);
    assert.equal(result.baselineNegative, null);
    assert.equal(firstNegativeMonth([-1, 5]), 0);
    assert.deepEqual(
      projectBalances({ start: 0.1, monthlyNet: 0.2, months: 2 }),
      [0.1, 0.3, 0.5],
    );
  });

  it('keeps months between 3 and 36', () => {
    assert.equal(clampMonths(1), 3);
    assert.equal(clampMonths(40), 36);
    assert.equal(clampMonths(12.4), 12);
    assert.equal(clampMonths(Number.NaN), 12);
    assert.equal(
      simulate(baseline, scenario({ months: 99 })).baseline.length,
      37,
    );
  });
});

describe('simulator controls', () => {
  it('parses money and percentages', () => {
    assert.deepEqual(parseMoneyField('35,000'), { ok: true, value: 35000 });
    assert.deepEqual(parseMoneyField(''), {
      ok: false,
      error: 'amountRequired',
    });
    assert.deepEqual(parseMoneyField('', { emptyIsZero: true }), {
      ok: true,
      value: 0,
    });
    assert.deepEqual(parseMoneyField('abc'), {
      ok: false,
      error: 'amountInvalid',
    });
    assert.deepEqual(parseMoneyField('1000000000'), {
      ok: false,
      error: 'amountTooLarge',
    });
    assert.deepEqual(parsePercentField('-15 %'), { ok: true, value: -15 });
    assert.deepEqual(parsePercentField('+12.5'), { ok: true, value: 12.5 });
    assert.deepEqual(parsePercentField(''), { ok: true, value: 0 });
    assert.deepEqual(parsePercentField('-'), {
      ok: false,
      error: 'percentInvalid',
    });
    assert.deepEqual(parsePercentField('-120'), {
      ok: false,
      error: 'percentRange',
    });
  });

  it('validates and builds monthly and one-time items', () => {
    assert.deepEqual(
      validateMonthlyDraft({ name: '', kind: 'add', amount: '0' }),
      {
        amount: 'amountZero',
      },
    );
    assert.deepEqual(
      validateMonthlyDraft({ name: 'x'.repeat(61), kind: 'cut', amount: '' }),
      {
        name: 'nameTooLong',
        amount: 'amountRequired',
      },
    );
    assert.deepEqual(
      toMonthlyItem(
        { name: ' Nuevo auto ', kind: 'add', amount: '8,000' },
        'id',
      ),
      {
        id: 'id',
        name: 'Nuevo auto',
        kind: 'add',
        amount: 8000,
      },
    );
    assert.deepEqual(
      validateOneTimeDraft({ name: '', amount: '500', month: '13' }, 12),
      {
        month: 'monthInvalid',
      },
    );
    assert.deepEqual(
      toOneTimeItem({ name: '', amount: '500', month: '3' }, 'o'),
      {
        id: 'o',
        name: '',
        amount: 500,
        month: 3,
      },
    );
  });
});

describe('simulator view', () => {
  const data = buildSimulatorData(
    {
      currentBalance: 10000.004,
      monthlyIncome: 30000,
      monthlyExpenses: 25000,
      monthsOfData: 6,
      currency: 'MXN',
    },
    '2026-10-13',
  );

  it('starts from the API baseline in the current month', () => {
    assert.deepEqual(data.baseline, baseline);
    assert.deepEqual(data.startMonth, { year: 2026, month: 10 });
    assert.equal(data.hasData, true);
    assert.equal(
      buildSimulatorData(
        {
          currentBalance: 0,
          monthlyIncome: 0,
          monthlyExpenses: 0,
          monthsOfData: 1,
          currency: 'MXN',
        },
        '2026-10-13',
      ).hasData,
      false,
    );
  });

  it('labels the months of the axis', () => {
    assert.deepEqual(monthAxisLabels(data.startMonth, 4, es), [
      'Hoy',
      'Nov',
      'Dic',
      'Ene 27',
      'Feb 27',
    ]);
    assert.deepEqual(monthAxisLabels(data.startMonth, 1, en), ['Today', 'Nov']);
    assert.equal(projectionMonthLabel(data.startMonth, 3, 'es'), 'Enero 2027');
  });

  it('describes the key numbers', () => {
    const result = simulate(
      baseline,
      scenario({
        months: 6,
        monthly: [{ id: 'car', name: 'Nuevo auto', kind: 'add', amount: 8000 }],
      }),
    );
    const view = describeResult(result, data, es);
    assert.equal(view.endBaseline, '$40,000.00');
    assert.equal(view.endScenario, '-$8,000.00');
    assert.equal(view.difference, '-$48,000.00');
    assert.equal(view.tone, 'down');
    assert.equal(view.scenarioNegative, 'Desde Febrero 2027');
    assert.equal(view.baselineNegative, 'Nunca');
    assert.equal(view.scenarioWarning, true);
    assert.equal(view.scenarioNet, '-$3,000.00');
    assert.equal(view.baselineNet, '+$5,000.00');
    assert.equal(view.endMonth, 'Abril 2027');

    const better = describeResult(
      simulate(baseline, scenario({ incomePercent: 10 })),
      data,
      en,
    );
    assert.equal(better.tone, 'up');
    assert.equal(better.difference, '+$36,000.00');
    assert.equal(better.scenarioNegative, 'Never');
  });
});

describe('balance chart', () => {
  it('scales every series on one axis', () => {
    const g = chartGeometry([
      [0, 100],
      [0, -100],
    ]);
    assert.deepEqual(g.xs, [0, 100]);
    assert.equal(g.ys[0]![1], 6);
    assert.equal(g.ys[1]![1], 94);
    assert.equal(g.zeroY, 50);
    assert.deepEqual(
      g.ticks.map((t) => t.value),
      [100, 0, -100],
    );
    assert.equal(g.paths[0], 'M0,50 L100,6');
  });

  it('centers a flat line and has no zero line when all is positive', () => {
    const g = chartGeometry([[500, 500, 500]]);
    assert.deepEqual(g.ys[0], [50, 50, 50]);
    assert.equal(g.zeroY, null);
    assert.deepEqual(chartGeometry([]).xs, []);
  });

  it('maps the pointer to a month and spaces the labels', () => {
    assert.equal(indexAt(0, 13), 0);
    assert.equal(indexAt(0.5, 13), 6);
    assert.equal(indexAt(2, 13), 12);
    assert.deepEqual(labeledIndexes(5, 7), [0, 1, 2, 3, 4]);
    assert.deepEqual(labeledIndexes(13, 7), [0, 2, 4, 6, 8, 10, 12]);
    assert.deepEqual(labeledIndexes(37, 7), [0, 6, 12, 18, 24, 30, 36]);
    const many = labeledIndexes(25, 7);
    assert.equal(many[0], 0);
    assert.equal(many.at(-1), 24);
    assert.ok(many.length <= 7);
  });

  it('writes short axis amounts', () => {
    const whole = (n: number) =>
      formatMoney(n, 'MXN', 'es', { wholeUnits: true });
    assert.equal(compactAmount(950, whole), '$950');
    assert.equal(compactAmount(1500, whole), '$1.5k');
    assert.equal(compactAmount(-48000, whole), '-$48k');
    assert.equal(compactAmount(1_250_000, whole), '$1.3M');
    const usd = (n: number) =>
      formatMoney(n, 'USD', 'en', { wholeUnits: true });
    assert.equal(compactAmount(20000, usd), 'US$20k');
  });
});
