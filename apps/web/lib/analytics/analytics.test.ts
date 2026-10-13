import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import type { ApiMonthlyReport } from '@/lib/finance/types';
import { testLocalizer } from '@/lib/i18n/testing';
import { buildAnalyticsView, trendMonths } from './view';

const es = testLocalizer('es');

const october = { year: 2026, month: 10 };

const report = (
  month: number,
  income: number,
  expenses: number,
): ApiMonthlyReport => ({
  year: 2026,
  month,
  currency: 'MXN',
  totalIncome: income,
  totalExpenses: expenses,
  netIncome: income - expenses,
  categoryBreakdown: [],
});

describe('buildAnalyticsView', () => {
  it('covers the selected month and the 5 before it', () => {
    assert.deepEqual(
      trendMonths(october).map((m) => m.month),
      [5, 6, 7, 8, 9, 10],
    );
  });

  it('compares with last month and computes the savings rate', () => {
    const view = buildAnalyticsView(
      {
        reports: [5, 6, 7, 8]
          .map((m) => report(m, 0, 0))
          .concat([report(9, 20000, 10000), report(10, 20000, 8000)]),
        categories: [],
        projection: [
          { date: '2026-11-14T18:00:00.000Z', projectedBalance: 15000 },
        ],
        accountCount: 2,
      },
      { selected: october, current: october },
      es,
    );
    assert.ok(!view.isEmpty);
    assert.equal(view.spending.amount, '$8,000.00');
    assert.equal(view.spending.trendPercent, '20%');
    assert.ok(view.spending.trendDown);
    assert.deepEqual(view.savings, {
      percentage: 60,
      rating: 'Excelente',
      caption: 'Ahorraste $12,000.00 de $20,000.00 de ingresos (60%).',
    });
    assert.equal(view.month.nextHref, null);
    assert.equal(view.month.prevHref, '/analytics?month=2026-09');
    assert.deepEqual(view.projection, [
      { label: 'Nov', balance: '$15,000.00', value: 15000 },
    ]);
    assert.equal(view.trend[5]!.expensePercent, 40);
  });

  it('is empty without accounts or movements and invents no trend', () => {
    const view = buildAnalyticsView(
      {
        reports: [5, 6, 7, 8, 9, 10].map((m) => report(m, 0, 0)),
        categories: [],
        projection: [],
        accountCount: 0,
      },
      { selected: october, current: october },
      es,
    );
    assert.ok(view.isEmpty);
    assert.equal(view.spending.trendPercent, null);
    assert.equal(view.savings, null);
  });
});
