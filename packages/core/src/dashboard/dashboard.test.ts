import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import type { ApiAccount } from '../finance/types';
import { testLocalizer } from '../i18n/testing';
import { buildDashboardView, type DashboardData } from './view';

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
});
