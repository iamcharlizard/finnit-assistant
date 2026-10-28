import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import type { ApiMonthlyReport } from '@/lib/finance/types';
import { testLocalizer } from '@/lib/i18n/testing';
import { budgetErrorMessage } from './api';
import {
  buildCreateBudgetInput,
  buildUpdateBudgetInput,
  capsSum,
  formOfBudget,
  formOfSuggestions,
  hasBudgetErrors,
  totalBelowCaps,
  validateBudgetForm,
  type BudgetForm,
} from './form';
import { budgetCategoryOptions } from './options';
import { capStatus, usedPercent } from './status';
import { roundCap, suggestCaps } from './suggestions';
import type { ApiBudget, ApiBudgetSummary, BudgetCategory } from './types';
import {
  buildBudgetCard,
  buildBudgetsView,
  outsideCaps,
  templateFor,
  type BudgetsData,
} from './view';

const es = testLocalizer('es');
const en = testLocalizer('en');

const october = { year: 2026, month: 10 };

const categories: BudgetCategory[] = [
  {
    id: 'food',
    name: 'Comida y restaurantes',
    parentId: null,
    key: 'categories.food',
  },
  {
    id: 'groceries',
    name: 'Supermercado',
    parentId: 'food',
    key: 'categories.food.groceries',
  },
  { id: 'restaurants', name: 'Restaurantes', parentId: 'food', key: null },
  { id: 'transport', name: 'Transporte', parentId: null, key: null },
  { id: 'gas', name: 'Gasolina', parentId: 'transport', key: null },
  { id: 'fun', name: 'Entretenimiento', parentId: null, key: null },
  { id: 'income', name: 'Ingresos', parentId: null, key: 'categories.income' },
  { id: 'salary', name: 'Sueldo', parentId: 'income', key: null },
];

const report = (
  month: number,
  lines: [string, number][],
  uncategorized = 0,
): ApiMonthlyReport => {
  const categorized = lines.reduce((s, [, a]) => s + a, 0);
  return {
    year: 2026,
    month,
    currency: 'MXN',
    totalIncome: 0,
    totalExpenses: categorized + uncategorized,
    netIncome: -(categorized + uncategorized),
    categoryBreakdown: lines.map(([categoryId, amount]) => ({
      categoryId,
      categoryName: categoryId,
      amount,
    })),
  };
};

const budget = (overrides: Partial<ApiBudget> = {}): ApiBudget => ({
  id: 'b-oct',
  year: 2026,
  month: 10,
  currency: 'MXN',
  amountTotal: null,
  categories: [
    { id: 'cap-food', categoryId: 'food', capAmount: 5000 },
    { id: 'cap-gas', categoryId: 'gas', capAmount: 1000 },
    { id: 'cap-fun', categoryId: 'fun', capAmount: 800 },
  ],
  ...overrides,
});

const summary: ApiBudgetSummary = {
  budgetId: 'b-oct',
  year: 2026,
  month: 10,
  totalBudgeted: 6800,
  totalSpent: 7000,
  categoryUsage: [
    {
      categoryId: 'food',
      budgeted: 5000,
      spent: 2000,
      remaining: 3000,
      percentage: 40,
    },
    {
      categoryId: 'gas',
      budgeted: 1000,
      spent: 850,
      remaining: 150,
      percentage: 85,
    },
    {
      categoryId: 'fun',
      budgeted: 800,
      spent: 1000,
      remaining: -200,
      percentage: 125,
    },
  ],
};

const data = (overrides: Partial<BudgetsData> = {}): BudgetsData => ({
  budgets: [budget()],
  categories,
  summary,
  report: report(
    10,
    [
      ['groceries', 1500],
      ['restaurants', 500],
      ['gas', 850],
      ['fun', 1000],
      ['transport', 300],
    ],
    2850,
  ),
  previousReports: [],
  ...overrides,
});

describe('capStatus', () => {
  it('warns from 80% and is over from 100%', () => {
    assert.equal(capStatus(799, 1000), 'ok');
    assert.equal(capStatus(800, 1000), 'warning');
    assert.equal(capStatus(999.99, 1000), 'warning');
    assert.equal(capStatus(1000, 1000), 'over');
    assert.equal(capStatus(1500, 1000), 'over');
  });

  it('treats a zero cap as over only when something was spent', () => {
    assert.equal(capStatus(0, 0), 'ok');
    assert.equal(capStatus(10, 0), 'over');
    assert.equal(usedPercent(10, 0), 100);
    assert.equal(usedPercent(1250, 1000), 125);
  });
});

describe('buildBudgetsView', () => {
  const view = buildBudgetsView(
    data(),
    { selected: october, current: october, currency: 'MXN' },
    es,
  );

  it('compares the whole month with the caps when there is no overall limit', () => {
    const totals = view.budget!.totals;
    assert.equal(totals.budgeted, '$6,800.00');
    assert.equal(totals.spent, '$7,000.00');
    assert.equal(totals.over, true);
    assert.equal(totals.remaining, '$200.00');
    assert.equal(totals.status, 'over');
    assert.equal(totals.explicitTotal, false);
  });

  it('uses the overall limit when there is one', () => {
    const withTotal = buildBudgetsView(
      data({ budgets: [budget({ amountTotal: 10000 })] }),
      { selected: october, current: october, currency: 'MXN' },
      es,
    ).budget!.totals;
    assert.equal(withTotal.budgeted, '$10,000.00');
    assert.equal(withTotal.percent, 70);
    assert.equal(withTotal.status, 'ok');
    assert.equal(withTotal.capsSum, '$6,800.00');
    assert.equal(withTotal.explicitTotal, true);
  });

  it('lists caps fullest first, with the parent of a subcategory', () => {
    assert.deepEqual(
      view.budget!.caps.map((c) => [c.categoryId, c.percent, c.status]),
      [
        ['fun', 125, 'over'],
        ['gas', 85, 'warning'],
        ['food', 40, 'ok'],
      ],
    );
    const gas = view.budget!.caps[1]!;
    assert.equal(gas.parentName, 'Transporte');
    assert.equal(gas.remaining, '$150.00');
    assert.equal(gas.over, false);
    assert.equal(view.budget!.caps[0]!.remaining, '$200.00');
    assert.equal(view.budget!.caps[0]!.over, true);
  });

  it('alerts on caps at 80% or more', () => {
    assert.deepEqual(
      view.budget!.alerts.map((a) => [a.categoryId, a.status]),
      [
        ['fun', 'over'],
        ['gas', 'warning'],
      ],
    );
    assert.equal(
      view.budget!.alerts[0]!.text,
      'Te pasaste del tope de Entretenimiento por $200.00.',
    );
    assert.equal(
      view.budget!.alerts[1]!.text,
      'Llevas 85% del tope de Gasolina; te quedan $150.00.',
    );
  });

  it('shows the spending no cap covers', () => {
    assert.equal(view.budget!.uncategorized, '$2,850.00');
    // Transporte itself has no cap (only Gasolina does).
    assert.equal(view.budget!.uncapped, '$300.00');
  });

  it('counts a cap with no usage as unspent', () => {
    const v = buildBudgetsView(
      data({ summary: { ...summary, categoryUsage: [] } }),
      { selected: october, current: october, currency: 'MXN' },
      es,
    );
    assert.ok(v.budget!.caps.every((c) => c.percent === 0));
  });

  it('links months and stops a year ahead', () => {
    assert.equal(view.month.label, 'Octubre 2026');
    assert.equal(view.month.prevHref, '/planning/budgets?month=2026-09');
    assert.equal(view.month.nextHref, '/planning/budgets?month=2026-11');
    const last = buildBudgetsView(
      data({ budgets: [], summary: null }),
      {
        selected: { year: 2027, month: 10 },
        current: october,
        currency: 'MXN',
      },
      es,
    );
    assert.equal(last.month.nextHref, null);
  });

  it('offers to copy the latest earlier budget and suggests caps without a budget', () => {
    const v = buildBudgetsView(
      data({
        budgets: [
          budget({ id: 'b-aug', month: 8 }),
          budget({ id: 'b-sep', month: 9 }),
          budget({ id: 'b-dec', month: 12 }),
        ],
        summary: null,
        previousReports: [
          report(9, [
            ['groceries', 3000],
            ['restaurants', 1000],
            ['salary', 9000],
          ]),
          report(8, [
            ['groceries', 2000],
            ['gas', 1200],
          ]),
          report(7, []),
        ],
      }),
      { selected: october, current: october, currency: 'MXN' },
      en,
    );
    assert.equal(v.budget, null);
    assert.deepEqual(v.empty!.template, {
      budgetId: 'b-sep',
      monthLabel: 'September 2026',
    });
    // Two months with spending; income left out; rolled up to the parent.
    assert.equal(v.empty!.suggestionMonths, 2);
    assert.deepEqual(
      v.empty!.suggestions.map((s) => [s.categoryId, s.average, s.cap]),
      [
        ['food', 3000, 3000],
        ['transport', 600, 600],
      ],
    );
    assert.equal(v.empty!.suggestionsTotal, '$3,600');
  });
});

describe('templateFor', () => {
  it('crosses the year', () => {
    const t = templateFor([budget({ id: 'dec', year: 2025, month: 12 })], {
      year: 2026,
      month: 1,
    });
    assert.equal(t?.id, 'dec');
  });
});

describe('outsideCaps', () => {
  it('counts subcategories of a capped parent as covered', () => {
    const result = outsideCaps(
      report(
        10,
        [
          ['groceries', 100],
          ['gas', 50],
        ],
        25,
      ),
      ['food'],
      categories,
    );
    assert.deepEqual(result, { uncategorized: 25, uncapped: 50 });
  });
});

describe('suggestCaps', () => {
  it('rounds caps up to 50 below 1,000 and to 100 above', () => {
    assert.equal(roundCap(612.4), 650);
    assert.equal(roundCap(1001), 1100);
    assert.equal(roundCap(3000), 3000);
  });

  it('returns nothing without spending', () => {
    assert.deepEqual(suggestCaps([report(9, [])], categories), []);
  });
});

describe('budget form', () => {
  const valid: BudgetForm = {
    total: '',
    caps: [
      { key: 'a', categoryId: 'food', amount: '5,000' },
      { key: 'b', categoryId: 'gas', amount: '1000.50' },
    ],
  };

  it('accepts caps without an overall limit', () => {
    assert.equal(hasBudgetErrors(validateBudgetForm(valid)), false);
    assert.equal(capsSum(valid), 6000.5);
  });

  it('needs a limit or a cap', () => {
    assert.equal(validateBudgetForm({ total: '', caps: [] }).form, 'empty');
    assert.equal(
      hasBudgetErrors(validateBudgetForm({ total: '20000', caps: [] })),
      false,
    );
  });

  it('flags missing, repeated and invalid caps per row', () => {
    const errors = validateBudgetForm({
      total: 'abc',
      caps: [
        { key: 'a', categoryId: 'food', amount: '100' },
        { key: 'b', categoryId: 'food', amount: '0' },
        { key: 'c', categoryId: '', amount: '' },
      ],
    });
    assert.equal(errors.total, 'totalInvalid');
    assert.deepEqual(errors.caps, {
      b: { category: 'categoryRepeated', amount: 'amountInvalid' },
      c: { category: 'categoryRequired', amount: 'amountRequired' },
    });
  });

  it('warns when the limit is below the caps', () => {
    assert.equal(totalBelowCaps({ ...valid, total: '3000' }), true);
    assert.equal(totalBelowCaps({ ...valid, total: '9000' }), false);
    assert.equal(totalBelowCaps(valid), false);
  });

  it('builds the create input', () => {
    assert.deepEqual(
      buildCreateBudgetInput(
        { ...valid, total: '8000' },
        { month: october, currency: 'MXN' },
      ),
      {
        year: 2026,
        month: 10,
        currency: 'MXN',
        amountTotal: 8000,
        categories: [
          { categoryId: 'food', capAmount: 5000 },
          { categoryId: 'gas', capAmount: 1000.5 },
        ],
      },
    );
    assert.equal(
      'amountTotal' in
        buildCreateBudgetInput(valid, { month: october, currency: 'MXN' }),
      false,
    );
  });

  it('sends the whole cap list and null to remove the limit on update', () => {
    assert.deepEqual(buildUpdateBudgetInput({ total: '', caps: [] }), {
      amountTotal: null,
      categories: [],
    });
  });

  it('round-trips a budget and fills from suggestions', () => {
    const form = formOfBudget(budget({ amountTotal: 1234.5 }));
    assert.equal(form.total, '1234.50');
    assert.deepEqual(
      form.caps.map((c) => [c.key, c.categoryId, c.amount]),
      [
        ['cap-food', 'food', '5000'],
        ['cap-gas', 'gas', '1000'],
        ['cap-fun', 'fun', '800'],
      ],
    );
    assert.deepEqual(
      formOfSuggestions([{ categoryId: 'food', average: 2950, cap: 3000 }])
        .caps,
      [{ key: 'suggested-food', categoryId: 'food', amount: '3000' }],
    );
  });
});

describe('budgetCategoryOptions', () => {
  it('leaves income out and keeps parents and children', () => {
    const values = budgetCategoryOptions(categories, 'es').map((o) => o.value);
    assert.ok(values.includes('food'));
    assert.ok(values.includes('groceries'));
    assert.ok(!values.includes('income'));
    assert.ok(!values.includes('salary'));
  });
});

describe('buildBudgetCard', () => {
  it('shows the month against its limit', () => {
    const card = buildBudgetCard(budget({ amountTotal: 10000 }), 8500, en);
    assert.deepEqual(card, {
      monthLabel: 'October 2026',
      spent: '$8,500.00',
      budgeted: '$10,000.00',
      remaining: '$1,500.00',
      over: false,
      percent: 85,
      status: 'warning',
    });
  });
});

describe('budgetErrorMessage', () => {
  it('translates known API errors', () => {
    assert.equal(
      budgetErrorMessage(
        new Error('Budget already exists for this month'),
        es.t,
      ),
      'Ya hay un presupuesto para ese mes. Recarga la página.',
    );
  });
});
