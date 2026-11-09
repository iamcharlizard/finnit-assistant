import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import type { ApiAccount } from '../finance/types';
import { testLocalizer } from '../i18n/testing';
import { MASKED_AMOUNT, maskIf } from '../finance/mask';
import {
  needsPinToShow,
  parseHideAmounts,
  shouldSuggestPin,
} from '../privacy/amounts';
import {
  buildDashboardView,
  maskDashboardView,
  type DashboardData,
} from './view';

const empty: DashboardData = {
  accounts: [],
  monthlyReport: {
    year: 2026,
    month: 10,
    currency: 'MXN',
    totalIncome: 0,
    totalExpenses: 0,
    netIncome: 0,
    categoryBreakdown: [],
  },
  upcomingPayments: [],
  transactionCount: 0,
  debtInsights: {
    byType: [],
    paidByMonth: [],
    projection: [],
    upcoming: { days30: 0, days60: 0, days90: 0 },
    upcomingMsi: { days30: 0, days60: 0, days90: 0 },
    monthlyPayments: 0,
    msiMonthlyPayments: 0,
    averageMonthlyIncome: 0,
    msi: [],
  },
};

const options = { today: '2026-10-14', month: { year: 2026, month: 10 } };
const es = testLocalizer('es');

const account = (overrides: Partial<ApiAccount>): ApiAccount => ({
  id: 'a',
  name: 'Cuenta',
  type: 'debit',
  currency: 'MXN',
  balanceCurrent: 0,
  archived: false,
  metadata: null,
  creditCardTerms: null,
  ...overrides,
});

describe('buildDashboardView', () => {
  it('is empty for a brand-new user, with zero (not invented) totals', () => {
    const view = buildDashboardView(empty, options, es);
    assert.ok(view.isEmpty);
    assert.equal(view.todayLabel, 'Miércoles, 14 de octubre');
    assert.equal(view.balance, null);
    assert.equal(view.month.income, '$0.00');
    assert.equal(view.debts, null);
  });

  it('shows available money, card debt and the month totals', () => {
    const view = buildDashboardView(
      {
        ...empty,
        accounts: [
          account({ id: 'd', balanceCurrent: 12000 }),
          account({ id: 'c', type: 'credit', balanceCurrent: -3000 }),
        ],
        monthlyReport: {
          ...empty.monthlyReport,
          totalIncome: 20000,
          totalExpenses: 4500.25,
        },
      },
      options,
      es,
    );
    assert.ok(!view.isEmpty);
    assert.deepEqual(view.balance, {
      available: '$12,000.00',
      creditDebt: '$3,000.00',
      net: '$9,000.00',
      accountCount: 2,
      otherCurrencies: [],
    });
    assert.equal(view.month.expenses, '$4,500.25');
    assert.equal(view.month.label, 'Octubre 2026');
  });

  it('names other currencies in the user’s language', () => {
    const accounts = [
      account({ id: 'd', balanceCurrent: 100 }),
      account({ id: 'u', currency: 'USD', balanceCurrent: 50 }),
    ];
    assert.deepEqual(
      buildDashboardView({ ...empty, accounts }, options, es).balance
        ?.otherCurrencies,
      ['US$50.00 en USD'],
    );
    const en = buildDashboardView(
      { ...empty, accounts },
      options,
      testLocalizer('en'),
    );
    assert.deepEqual(en.balance?.otherCurrencies, ['US$50.00 in USD']);
    assert.equal(en.month.label, 'October 2026');
    assert.equal(en.todayLabel, 'Wednesday, October 14');
  });

  it('shows the debts only when there is a loan or debt (card MSI alone is not)', () => {
    const insights = (type: 'personal' | 'msi') => ({
      ...empty.debtInsights,
      byType: [{ type, remaining: 1000, totalOwed: 1000, paid: 0, count: 1 }],
    });
    const withLoan = buildDashboardView(
      { ...empty, debtInsights: insights('personal') },
      options,
      es,
    );
    assert.equal(withLoan.debts?.today, options.today);
    assert.equal(
      buildDashboardView(
        { ...empty, debtInsights: insights('msi') },
        options,
        es,
      ).debts,
      null,
    );
  });

  it('leaves accounts out of the total when the user says so', () => {
    const view = buildDashboardView(
      {
        ...empty,
        accounts: [
          account({ id: 'd', name: 'Nómina', balanceCurrent: 1000 }),
          account({
            id: 's',
            name: 'Apartado',
            balanceCurrent: 5000,
            includeInTotal: false,
          }),
        ],
      },
      options,
      es,
    );
    assert.equal(view.balance?.available, '$1,000.00');
    // Those in the total first, then the rest, marked.
    assert.deepEqual(
      view.accounts.map((a) => [a.name, a.excluded]),
      [
        ['Nómina', false],
        ['Apartado', true],
      ],
    );
    assert.equal(view.accountCount, 2);
  });

  it('shows at most five accounts, the biggest first', () => {
    const view = buildDashboardView(
      {
        ...empty,
        accounts: [1, 2, 3, 4, 5, 6].map((n) =>
          account({ id: `a${n}`, name: `C${n}`, balanceCurrent: n * 100 }),
        ),
      },
      options,
      es,
    );
    assert.deepEqual(
      view.accounts.map((a) => a.name),
      ['C6', 'C5', 'C4', 'C3', 'C2'],
    );
    assert.equal(view.accountCount, 6);
  });

  it('compares the month so far with the same days of last month', () => {
    const view = buildDashboardView(
      {
        ...empty,
        accounts: [account({ id: 'd', balanceCurrent: 1200 })],
        balanceHistory: {
          currency: 'MXN',
          accounts: 1,
          // Newest first.
          days: [
            {
              date: '2026-10-14',
              availableOpening: 1000,
              availableClosing: 1200,
              debtOpening: 0,
              debtClosing: 0,
              movements: 1,
              complete: true,
            },
            {
              date: '2026-10-13',
              availableOpening: 1000,
              availableClosing: 1000,
              debtOpening: 0,
              debtClosing: 0,
              movements: 0,
              complete: true,
            },
          ],
        },
        cashFlow: [
          { date: '2026-09-02', income: 1000, expenses: 200 },
          // After the 14th: not compared.
          { date: '2026-09-20', income: 0, expenses: 999 },
          { date: '2026-10-01', income: 0, expenses: 100 },
          { date: '2026-10-10', income: 0, expenses: 150 },
        ],
      },
      options,
      es,
    );
    const [balance, expenses, income, pending] = view.stats;
    assert.equal(balance?.value, '$1,200.00');
    assert.deepEqual(balance?.spark, [1000, 1200]);
    assert.deepEqual(balance?.trend, {
      label: '+20.0%',
      direction: 'up',
      tone: 'positive',
    });
    assert.equal(expenses?.value, '$250.00');
    assert.equal(expenses?.spark.length, 14);
    // Spending up 25 %: bad news.
    assert.deepEqual(expenses?.trend, {
      label: '+25.0%',
      direction: 'up',
      tone: 'negative',
    });
    assert.deepEqual(income?.trend, {
      label: '-100.0%',
      direction: 'down',
      tone: 'negative',
    });
    assert.equal(pending?.value, '$0.00');
    assert.equal(pending?.caption, 'Nada por pagar');
    assert.equal(pending?.trend, null);
  });

  it('caps changes from a tiny base', () => {
    const view = buildDashboardView(
      {
        ...empty,
        accounts: [account({ id: 'd', balanceCurrent: 900 })],
        balanceHistory: {
          currency: 'MXN',
          accounts: 1,
          days: [
            {
              date: '2026-10-14',
              availableOpening: 4,
              availableClosing: 900,
              debtOpening: 0,
              debtClosing: 0,
              movements: 1,
              complete: true,
            },
            {
              date: '2026-10-13',
              availableOpening: 4,
              availableClosing: 4,
              debtOpening: 0,
              debtClosing: 0,
              movements: 0,
              complete: true,
            },
          ],
        },
      },
      options,
      es,
    );
    assert.equal(view.stats[0]?.trend?.label, '>+999%');
  });

  it('has no trend without last month to compare with', () => {
    const view = buildDashboardView(
      { ...empty, cashFlow: [{ date: '2026-10-01', income: 0, expenses: 10 }] },
      options,
      es,
    );
    assert.equal(view.stats[1]?.trend, null);
    assert.equal(view.stats[0]?.trend, null);
  });
});

describe('maskIf', () => {
  it('hides every amount behind the same placeholder', () => {
    assert.equal(maskIf(true, '$1,234.00'), MASKED_AMOUNT);
    assert.equal(maskIf(false, '$1,234.00'), '$1,234.00');
  });
});

describe('maskDashboardView', () => {
  it('hides every amount on the home screen', () => {
    const view = maskDashboardView(
      buildDashboardView(
        {
          ...empty,
          accounts: [account({ id: 'd', balanceCurrent: 1000 })],
          cashFlow: [{ date: '2026-10-01', income: 5, expenses: 10 }],
        },
        options,
        es,
      ),
    );
    assert.equal(view.balance?.available, MASKED_AMOUNT);
    assert.equal(view.month.income, MASKED_AMOUNT);
    assert.ok(view.stats.every((s) => s.value === MASKED_AMOUNT));
    assert.ok(view.stats.every((s) => s.spark.length === 0 && !s.trend));
    assert.equal(view.accounts[0]?.balance, MASKED_AMOUNT);
  });
});

describe('amounts privacy', () => {
  it('asks the PIN to show only when there is one and it is locked', () => {
    assert.ok(needsPinToShow({ hasPin: true, unlocked: false }));
    assert.ok(!needsPinToShow({ hasPin: true, unlocked: true }));
    assert.ok(!needsPinToShow({ hasPin: false, unlocked: false }));
    assert.ok(shouldSuggestPin({ hasPin: false, unlocked: false }, false));
    assert.ok(!shouldSuggestPin({ hasPin: false, unlocked: false }, true));
    assert.ok(!shouldSuggestPin({ hasPin: true, unlocked: false }, false));
    assert.ok(parseHideAmounts('1') && !parseHideAmounts(undefined));
  });
});
