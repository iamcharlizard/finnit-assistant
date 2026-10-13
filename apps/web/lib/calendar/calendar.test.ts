import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import type { ApiAccount, ApiUpcomingPayment } from '@/lib/finance/types';
import { testLocalizer } from '@/lib/i18n/testing';
import { buildCalendarView } from './view';

const es = testLocalizer('es');

const october = { year: 2026, month: 10 };

const payment = (
  dueDate: string,
  name: string,
  overrides: Partial<ApiUpcomingPayment> = {},
): ApiUpcomingPayment => ({
  dueDate,
  expectedAmount: 100,
  occurrenceId: `o-${name}`,
  status: 'upcoming',
  recurringExpense: {
    id: name,
    name,
    kind: 'subscription',
    currency: 'MXN',
    accountId: null,
    isVariableAmount: false,
  },
  ...overrides,
});

const card: ApiAccount = {
  id: 'tdc',
  name: 'Oro',
  type: 'credit',
  currency: 'MXN',
  balanceCurrent: -500,
  archived: false,
  metadata: null,
  creditCardTerms: { statementDay: 20, paymentDueDay: 31 },
};

describe('buildCalendarView', () => {
  it('lays out the month starting on Monday', () => {
    const view = buildCalendarView(
      { payments: [], accounts: [], recurringTotals: [], recurringCount: 0 },
      { month: october, today: '2026-10-14' },
      es,
    );
    // Oct 1, 2026 is a Thursday: Mon 28 – Wed 30 of September lead.
    assert.deepEqual(view.month.leadingDays, [28, 29, 30]);
    assert.equal(view.month.daysInMonth, 31);
    assert.equal(view.month.today, 14);
    assert.ok(view.isEmpty);
    assert.equal(view.totals.open, '$0.00');
  });

  it('puts payments and card dates on their days and adds up what is open', () => {
    const view = buildCalendarView(
      {
        payments: [
          payment('2026-10-05T00:00:00.000Z', 'Gym', { status: 'paid' }),
          payment('2026-10-20T00:00:00.000Z', 'Netflix'),
          payment('2026-10-20T00:00:00.000Z', 'Spotify'),
        ],
        accounts: [card],
        recurringTotals: [{ currency: 'MXN', monthlyCost: 350 }],
        recurringCount: 3,
      },
      { month: { year: 2026, month: 11 }, today: '2026-10-14' },
      es,
    );
    // November view: October payments are outside it.
    assert.equal(view.monthPayments.length, 0);
    assert.equal(view.month.today, null);
    // Payment day 31 falls on Nov 30.
    assert.deepEqual(view.events[30], { label: 'Pago TDC', accent: 'neon' });

    const oct = buildCalendarView(
      {
        payments: [
          payment('2026-10-05T00:00:00.000Z', 'Gym', { status: 'paid' }),
          payment('2026-10-20T00:00:00.000Z', 'Netflix'),
          payment('2026-10-20T00:00:00.000Z', 'Spotify'),
        ],
        accounts: [card],
        recurringTotals: [{ currency: 'MXN', monthlyCost: 350 }],
        recurringCount: 3,
      },
      { month: october, today: '2026-10-14' },
      es,
    );
    assert.equal(oct.month.name, 'octubre');
    assert.deepEqual(oct.events[5], { label: 'Gym', accent: 'primary' });
    assert.deepEqual(oct.events[20], { label: '2 pagos', accent: 'primary' });
    assert.deepEqual(
      oct.days[20]!.cardDates.map((d) => d.label),
      ['Corte de Oro'],
    );
    assert.deepEqual(oct.totals, {
      fixedMonthly: '$350.00',
      open: '$200.00',
      openCount: 2,
    });
  });
});
