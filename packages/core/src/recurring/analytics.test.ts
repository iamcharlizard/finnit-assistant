import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { testLocalizer } from '@finnit/core/i18n/testing';
import { buildRecurringAnalytics } from './analytics';
import {
  answersOf,
  firstOpenStep,
  isComplete,
  ESSENTIAL_QUESTIONS,
} from './essentials';
import type { ApiRecurringExpense } from './types';

const es = testLocalizer('es');

const expense = (
  overrides: Partial<ApiRecurringExpense> = {},
): ApiRecurringExpense => ({
  id: 'netflix',
  name: 'Netflix',
  kind: 'subscription',
  trackingMode: 'automatic',
  frequency: 'monthly',
  interval: 1,
  startDate: '2026-01-05T00:00:00.000Z',
  endDate: null,
  amount: 219,
  isVariableAmount: false,
  currency: 'MXN',
  accountId: null,
  categoryId: 'streaming',
  merchantPattern: null,
  installmentsTotal: null,
  installmentsPaid: 0,
  active: true,
  notes: null,
  nextDueDate: null,
  monthlyCost: 219,
  ...overrides,
});

const categories = [
  { id: 'fun', name: 'Entretenimiento', parentId: null, key: null },
  { id: 'streaming', name: 'Streaming', parentId: 'fun', key: null },
  { id: 'home', name: 'Vivienda', parentId: null, key: null },
];

describe('recurring analytics', () => {
  const view = buildRecurringAnalytics(
    {
      expenses: [
        expense({ essentialLevel: 'dispensable', essentialReason: 'Casi no' }),
        expense({
          id: 'spotify',
          name: 'Spotify',
          monthlyCost: 129,
          essentialLevel: 'reducible',
        }),
        expense({
          id: 'rent',
          name: 'Renta',
          kind: 'housing',
          categoryId: 'home',
          monthlyCost: 9000,
          essentialLevel: 'essential',
        }),
        expense({ id: 'gym', name: 'Gym', categoryId: null, monthlyCost: 600 }),
        expense({ id: 'loan', name: 'Préstamo', kind: 'loan', monthlyCost: 2000, debtId: 'd1' }),
        expense({ id: 'old', active: false, monthlyCost: 99 }),
      ],
      categories,
      monthlyTotals: [{ currency: 'MXN', monthlyCost: 11948 }],
    },
    es,
  );

  it('adds up by top category and kind, active ones only', () => {
    assert.equal(view.count, 5);
    assert.deepEqual(
      view.byCategory.map((b) => [b.label, b.value]),
      [
        ['Vivienda', 9000],
        ['Entretenimiento', 2348],
        ['Sin categoría', 600],
      ],
    );
    assert.equal(view.debts.count, 1);
  });

  it('splits what the AI judged and what dropping the dispensable saves', () => {
    const levels = Object.fromEntries(
      view.essentials.levels.map((l) => [l.level, l.value]),
    );
    assert.deepEqual(levels, {
      essential: 9000,
      reducible: 129,
      dispensable: 219,
    });
    assert.equal(view.essentials.savingsValue, 219);
    assert.deepEqual(
      view.essentials.items.map((i) => i.id),
      ['netflix', 'spotify', 'rent'],
    );
    // The gym is still to analyze; the loan never is.
    assert.equal(view.essentials.pending, 1);
  });
});

describe('the essentials questionnaire', () => {
  it('reads known answers and finds the first open question', () => {
    const answers = answersOf({
      answers: [
        { question: 'household', answer: 'alone' },
        { question: 'work', answer: 'astronaut' },
      ],
      updatedAt: '2026-11-16T00:00:00Z',
    });
    assert.deepEqual(answers, { household: 'alone' });
    assert.equal(isComplete(answers), false);
    assert.equal(firstOpenStep(answers), 1);
    const full = Object.fromEntries(
      ESSENTIAL_QUESTIONS.map((q) => [q.key, q.options[0]]),
    );
    assert.equal(isComplete(full), true);
  });
});
