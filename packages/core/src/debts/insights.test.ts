import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { testLocalizer } from '../i18n/testing';
import { buildDebtInsightsView, loadLevel } from './insights-view';
import type { ApiDebtInsights } from './types';

const es = testLocalizer('es');
const today = '2026-10-30';

const data: ApiDebtInsights = {
  byType: [
    {
      type: 'personal',
      remaining: 4_000,
      totalOwed: 5_000,
      paid: 1_000,
      count: 1,
    },
    {
      type: 'institutional',
      remaining: 8_000,
      totalOwed: 12_000,
      paid: 4_000,
      count: 2,
    },
    { type: 'card', remaining: 0, totalOwed: 3_000, paid: 3_000, count: 1 },
    { type: 'msi', remaining: 6_000, totalOwed: 12_000, paid: 6_000, count: 1 },
  ],
  paidByMonth: [
    { month: '2026-09', counted: 0, historical: 1_000, msi: 500 },
    { month: '2026-10', counted: 2_000, historical: 0, msi: 500 },
  ],
  projection: [
    { month: '2026-11', debt: 10_000, msi: 5_500 },
    { month: '2026-12', debt: 0, msi: 5_000 },
  ],
  upcoming: { days30: 2_000, days60: 4_000, days90: 6_000 },
  upcomingMsi: { days30: 500, days60: 1_000, days90: 1_500 },
  monthlyPayments: 2_000,
  msiMonthlyPayments: 500,
  averageMonthlyIncome: 10_000,
  msi: [
    {
      id: 'tv',
      name: 'Pantalla',
      accountName: 'Oro',
      installmentAmount: 500,
      installmentsTotal: 24,
      installmentsPaid: 12,
      remaining: 6_000,
      nextDueDate: '2026-11-10T00:00:00.000Z',
    },
  ],
};

describe('debt insights view', () => {
  it('leaves card MSI out by default', () => {
    const view = buildDebtInsightsView(data, { today, includeMsi: false }, es);
    assert.equal(view.current, '$12,000');
    assert.equal(view.total, '$20,000');
    assert.equal(view.paidPercent, 40);
    // Fixed category order, only what is still owed.
    assert.deepEqual(
      view.types.map((t) => [t.type, Math.round(t.percent)]),
      [
        ['institutional', 100],
        ['personal', 50],
      ],
    );
    assert.deepEqual(view.paidSeries, ['counted', 'historical']);
    assert.equal(view.months[1]!.total, '$2,000');
    assert.equal(view.paidOffLabel, 'Dic 26');
    assert.deepEqual(view.load, {
      percent: 20,
      level: 'low',
      income: '$10,000',
    });
    assert.equal(view.hasMsi, true);
  });

  it('adds card MSI everywhere when included', () => {
    const view = buildDebtInsightsView(data, { today, includeMsi: true }, es);
    assert.equal(view.current, '$18,000');
    assert.equal(view.types.at(-1)!.type, 'msi');
    assert.deepEqual(view.paidSeries, ['counted', 'historical', 'msi']);
    assert.equal(view.projection[1]!.value, 5_000);
    assert.equal(view.paidOffLabel, null);
    assert.equal(view.upcoming.days30, '$2,500');
    assert.equal(view.load!.percent, 25);
    assert.equal(view.msi[0]!.progress, '12 de 24 pagos');
  });

  it('grades the debt load and handles no income', () => {
    assert.equal(loadLevel(20), 'low');
    assert.equal(loadLevel(35), 'moderate');
    assert.equal(loadLevel(36), 'high');
    const view = buildDebtInsightsView(
      { ...data, averageMonthlyIncome: 0 },
      { today, includeMsi: false },
      es,
    );
    assert.equal(view.load, null);
  });
});
