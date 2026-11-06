import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { testLocalizer } from '@finnit/core/i18n/testing';
import type { ApiAccount } from '@finnit/core/finance/types';
import {
  buildCalendarSummary,
  nextDueDay,
  summaryVariables,
} from '@finnit/core/calendar/summary';
import {
  DEFAULT_EXPENSE_FILTERS,
  NO_ACCOUNT,
  accountOptions,
  activeFilterCount,
  applyExpenseFilters,
  kindOptions,
  parseExpenseFilters,
  withExpenseFilters,
} from '@finnit/core/recurring/filters';
import type {
  ApiRecurringExpense,
  ApiRecurringPayment,
} from '@finnit/core/recurring/types';
import type { RecurringData } from '@finnit/core/recurring/view';

const es = testLocalizer('es');
const TODAY = '2026-10-13';

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
  amount: 200,
  isVariableAmount: false,
  currency: 'MXN',
  accountId: 'tdc',
  categoryId: null,
  merchantPattern: null,
  installmentsTotal: null,
  installmentsPaid: 0,
  active: true,
  notes: null,
  nextDueDate: '2026-11-05T00:00:00.000Z',
  monthlyCost: 200,
  ...overrides,
});

const payment = (
  day: string,
  amount: number,
  status: ApiRecurringPayment['status'],
  e: Partial<ApiRecurringExpense> = {},
): ApiRecurringPayment => ({
  dueDate: `${day}T00:00:00.000Z`,
  expectedAmount: amount,
  occurrenceId: `o-${day}-${e.id ?? 'netflix'}`,
  status,
  recurringExpense: expense(e),
});

const card: ApiAccount = {
  id: 'tdc',
  name: 'Oro',
  type: 'credit',
  currency: 'MXN',
  balanceCurrent: -1000,
  archived: false,
  metadata: null,
  creditCardTerms: { statementDay: 20, paymentDueDay: 5 },
};
const debit: ApiAccount = {
  ...card,
  id: 'deb',
  name: 'Nómina',
  type: 'debit',
  balanceCurrent: 5000,
  creditCardTerms: null,
};

const loan = expense({
  id: 'auto',
  name: 'Auto',
  kind: 'loan',
  accountId: 'deb',
  amount: 3000,
  monthlyCost: 3000,
});

const data: RecurringData = {
  payments: [
    payment('2026-10-05', 200, 'paid'),
    payment('2026-10-10', 3000, 'upcoming', loan),
    payment('2026-10-20', 200, 'upcoming', { id: 'spotify', name: 'Spotify' }),
    payment('2026-10-25', 99, 'skipped', { id: 'gym', name: 'Gym' }),
    payment('2026-11-05', 200, 'upcoming'),
    payment('2026-11-10', 3000, 'upcoming', loan),
    // Outside the six months.
    payment('2027-05-05', 200, 'upcoming'),
  ],
  expenses: [
    expense(),
    expense({ id: 'spotify', name: 'Spotify', monthlyCost: 200 }),
    loan,
    expense({ id: 'old', name: 'Old', active: false, monthlyCost: 50 }),
  ],
  accounts: [card, debit],
  categories: [],
  monthlyTotals: [{ currency: 'MXN', monthlyCost: 3400 }],
};

describe('calendar summary', () => {
  it('asks for this month and the five after it', () => {
    const v = summaryVariables(TODAY);
    assert.equal(v.from.slice(0, 10), '2026-10-01');
    assert.match(v.to, /^2026-03-31|^2027-03-31|^2027-04-01/);
  });

  it('finds a card due day this month or the next', () => {
    assert.equal(nextDueDay(20, TODAY), '2026-10-20');
    assert.equal(nextDueDay(5, TODAY), '2026-11-05');
    assert.equal(nextDueDay(31, '2026-02-10'), '2026-02-28');
  });

  const summary = buildCalendarSummary(data, TODAY, es);

  it('stacks the next six months by series; cards on their next due date', () => {
    assert.equal(summary.months.length, 6);
    const [oct, nov, dec] = summary.months;
    assert.deepEqual(
      oct!.segments.map((s) => [s.series, s.value]),
      [
        ['recurring', 400],
        ['loans', 3000],
        ['cards', 0],
      ],
    );
    // The card's debt today, due Nov 5.
    assert.deepEqual(
      nov!.segments.map((s) => s.value),
      [200, 3000, 1000],
    );
    assert.equal(dec!.value, 0);
    assert.equal(nov!.percent, 100);
    assert.equal(summary.hasCardEstimate, true);
  });

  it('adds fixed spending by kind and account, active ones only', () => {
    assert.deepEqual(
      summary.byKind.map((b) => [b.key, b.value, b.count]),
      [
        ['loan', 3000, 1],
        ['subscription', 400, 2],
      ],
    );
    assert.deepEqual(
      summary.byAccount.map((b) => [b.label, b.value]),
      [
        ['Nómina', 3000],
        ['Oro', 400],
      ],
    );
    assert.equal(summary.byKind[0]!.percent, 100);
  });

  it("splits this month's payments into paid, pending and overdue", () => {
    assert.deepEqual(
      summary.progress.parts.map((p) => [p.part, p.value, p.count]),
      [
        ['paid', 200, 1],
        ['pending', 200, 1],
        // Due Oct 10, still upcoming on the 13th.
        ['overdue', 3000, 1],
      ],
    );
    assert.equal(summary.progress.value, 3400);
  });
});

describe('recurring filters', () => {
  const items = [
    {
      id: 'n',
      name: 'Netflix',
      kind: 'subscription' as const,
      active: true,
      monthlyCost: 200,
      accountLabel: 'Oro',
      categoryLabel: 'Streaming',
      expense: { accountId: 'tdc', nextDueDate: '2026-11-05T00:00:00.000Z' },
    },
    {
      id: 'a',
      name: 'Auto',
      kind: 'loan' as const,
      active: true,
      monthlyCost: 3000,
      accountLabel: 'Nómina',
      categoryLabel: null,
      expense: { accountId: 'deb', nextDueDate: '2026-10-20T00:00:00.000Z' },
    },
    {
      id: 'g',
      name: 'Gimnasio',
      kind: 'membership' as const,
      active: false,
      monthlyCost: 500,
      accountLabel: null,
      categoryLabel: 'Salud',
      expense: { accountId: null, nextDueDate: null },
    },
  ];

  it('reads and writes the URL, leaving defaults out', () => {
    const f = parseExpenseFilters({
      q: 'net',
      status: 'all',
      kind: 'loan,nope,loan',
      account: 'tdc',
      sort: 'amount',
    });
    assert.deepEqual(f, {
      q: 'net',
      status: 'all',
      kinds: ['loan'],
      accounts: ['tdc'],
      sort: 'amount',
    });
    assert.deepEqual(
      parseExpenseFilters({ status: 'x', sort: 'y' }),
      DEFAULT_EXPENSE_FILTERS,
    );
    assert.equal(
      withExpenseFilters('?tab=list&q=old', { ...f, q: '' }),
      '?tab=list&status=all&kind=loan&account=tdc&sort=amount',
    );
    assert.equal(withExpenseFilters('', DEFAULT_EXPENSE_FILTERS), '');
    assert.equal(activeFilterCount(f), 3);
  });

  it('filters by status, kind, account and text (no accents), and sorts', () => {
    const run = (patch: Partial<typeof DEFAULT_EXPENSE_FILTERS>) =>
      applyExpenseFilters(
        items,
        { ...DEFAULT_EXPENSE_FILTERS, ...patch },
        'es',
      ).map((e) => e.id);
    assert.deepEqual(run({}), ['a', 'n']);
    assert.deepEqual(run({ status: 'all' }), ['a', 'n', 'g']);
    assert.deepEqual(run({ status: 'all', sort: 'amount' }), ['a', 'g', 'n']);
    assert.deepEqual(run({ status: 'all', sort: 'name' }), ['a', 'g', 'n']);
    assert.deepEqual(run({ kinds: ['subscription'] }), ['n']);
    assert.deepEqual(run({ status: 'all', accounts: [NO_ACCOUNT] }), ['g']);
    assert.deepEqual(run({ q: 'nomina' }), ['a']);
    assert.deepEqual(run({ status: 'all', q: 'SALUD' }), ['g']);
  });

  it('offers only the kinds and accounts the user has, with counts', () => {
    assert.deepEqual(
      kindOptions(items, (k) => k).map((o) => [o.value, o.count]),
      // The app's order of kinds.
      [
        ['subscription', 1],
        ['loan', 1],
        ['membership', 1],
      ],
    );
    assert.deepEqual(
      accountOptions(items, 'Sin cuenta', 'es').map((o) => [o.value, o.label]),
      [
        ['deb', 'Nómina'],
        ['tdc', 'Oro'],
        [NO_ACCOUNT, 'Sin cuenta'],
      ],
    );
  });
});
