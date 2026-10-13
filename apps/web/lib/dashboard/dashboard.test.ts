import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import type { ApiAccount } from '@/lib/finance/types';
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
  transactions: [],
  transactionCount: 0,
  categories: [],
};

const options = { today: '2026-10-14', month: { year: 2026, month: 10 } };

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
    const view = buildDashboardView(empty, options);
    assert.ok(view.isEmpty);
    assert.equal(view.balance, null);
    assert.equal(view.month.income, '$0.00');
    assert.deepEqual(view.recent, []);
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
});
