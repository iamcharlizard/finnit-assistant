import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { creditOwed, nextMonthlyDay, summarizeBalances } from './accounts';
import { spendingByCategory } from './breakdown';
import {
  categoryIconKey,
  categoryLabel,
  iconKeyForName,
  indexCategories,
  rootCategory,
} from './categories';
import {
  addDays,
  dayHeading,
  dayKeyOf,
  isDayKey,
  monthLabel,
  parseMonthParam,
  relativeDayLabel,
  shiftMonth,
  timeOf,
  todayKey,
  weekdayIndex,
} from './dates';
import { formatMoney, percentOf } from './money';
import { toPaymentRow } from './payments';
import { direction, groupByDay, toTransactionRow } from './transactions';
import type { ApiAccount, ApiTransaction, ApiUpcomingPayment } from './types';

const account = (overrides: Partial<ApiAccount> = {}): ApiAccount => ({
  id: 'a1',
  name: 'Nómina',
  type: 'debit',
  currency: 'MXN',
  balanceCurrent: 1000,
  archived: false,
  metadata: null,
  creditCardTerms: null,
  ...overrides,
});

const tx = (overrides: Partial<ApiTransaction> = {}): ApiTransaction => ({
  id: 't1',
  type: 'expense',
  amount: 80,
  currency: 'MXN',
  txnDate: '2026-10-14T20:32:00.000Z',
  description: null,
  merchantName: 'OXXO',
  isPending: false,
  source: 'manual',
  accountId: 'a1',
  account: { id: 'a1', name: 'Nómina', type: 'debit' },
  category: null,
  ...overrides,
});

const CATEGORIES = indexCategories([
  { id: 'food', name: 'Food & Dining', parentId: null },
  { id: 'rest', name: 'Restaurants', parentId: 'food' },
  { id: 'mine', name: 'Mascotas', parentId: null },
]);

describe('formatMoney', () => {
  it('formats the same text everywhere', () => {
    assert.equal(formatMoney(1234.5), '$1,234.50');
    assert.equal(formatMoney(-80), '-$80.00');
    assert.equal(formatMoney(1200, 'MXN', { sign: 'always' }), '+$1,200.00');
    assert.equal(formatMoney(-5, 'MXN', { sign: 'never' }), '$5.00');
    assert.equal(formatMoney(0, 'MXN', { sign: 'always' }), '$0.00');
    assert.equal(formatMoney(-0.001), '$0.00');
    assert.equal(formatMoney(1234567.891, 'USD'), 'US$1,234,567.89');
    assert.equal(formatMoney(20000, 'MXN', { wholeUnits: true }), '$20,000');
    assert.equal(formatMoney(10, 'COP'), 'COP 10.00');
  });

  it('gives percentages of a positive total only', () => {
    assert.equal(percentOf(25, 200), 13);
    assert.equal(percentOf(5, 0), 0);
  });
});

describe('dates', () => {
  it('reads date-only values as their UTC day and instants in Mexico City', () => {
    assert.equal(dayKeyOf('2026-10-01T00:00:00.000Z'), '2026-10-01');
    assert.equal(timeOf('2026-10-01T00:00:00.000Z'), null);
    // 01:30 UTC on Oct 2 is still Oct 1 in Mexico City (UTC-6).
    assert.equal(dayKeyOf('2026-10-02T01:30:00.000Z'), '2026-10-01');
    assert.equal(timeOf('2026-10-02T01:30:00.000Z'), '19:30');
    assert.equal(todayKey(new Date('2026-10-14T05:00:00Z')), '2026-10-13');
  });

  it('does day and month arithmetic', () => {
    assert.equal(addDays('2026-12-30', 3), '2027-01-02');
    assert.equal(weekdayIndex('2026-10-12'), 0); // Monday
    assert.equal(weekdayIndex('2026-10-18'), 6); // Sunday
    assert.deepEqual(shiftMonth({ year: 2026, month: 1 }, -1), {
      year: 2025,
      month: 12,
    });
    assert.equal(monthLabel({ year: 2026, month: 10 }), 'Octubre 2026');
    assert.ok(isDayKey('2026-02-28'));
    assert.ok(!isDayKey('2026-02-30'));
  });

  it('parses ?month and falls back on anything else', () => {
    const fallback = { year: 2026, month: 10 };
    assert.deepEqual(parseMonthParam('2026-03', fallback), {
      year: 2026,
      month: 3,
    });
    assert.deepEqual(parseMonthParam('2026-13', fallback), fallback);
    assert.deepEqual(parseMonthParam(['2026-03'], fallback), fallback);
    assert.deepEqual(parseMonthParam(undefined, fallback), fallback);
  });

  it('labels days relative to today', () => {
    assert.equal(dayHeading('2026-10-14', '2026-10-14'), 'Hoy, 14 de octubre');
    assert.equal(dayHeading('2026-10-13', '2026-10-14'), 'Ayer, 13 de octubre');
    assert.equal(
      dayHeading('2025-12-01', '2026-10-14'),
      'Lunes, 1 de diciembre de 2025',
    );
    assert.equal(relativeDayLabel('2026-10-17', '2026-10-14'), 'En 3 días');
    assert.equal(relativeDayLabel('2026-10-15', '2026-10-14'), 'Mañana');
    assert.equal(relativeDayLabel('2026-10-12', '2026-10-14'), 'Hace 2 días');
  });
});

describe('categories', () => {
  it('translates starter categories and keeps the user’s own', () => {
    assert.equal(categoryLabel('Food & Dining'), 'Comida');
    assert.equal(categoryLabel('Mascotas'), 'Mascotas');
    assert.equal(categoryLabel(null), 'Sin categoría');
  });

  it('picks icons from the name, specific rules first', () => {
    assert.equal(iconKeyForName('Health Insurance'), 'insurance');
    assert.equal(iconKeyForName('Subscriptions'), 'subscriptions');
    assert.equal(iconKeyForName('Gas'), 'fuel');
    assert.equal(iconKeyForName('Mascotas'), 'other');
  });

  it('walks up to the top-level category', () => {
    assert.equal(rootCategory(CATEGORIES, 'rest')?.id, 'food');
    assert.equal(categoryIconKey(CATEGORIES, 'rest'), 'food');
    assert.equal(rootCategory(CATEGORIES, 'missing'), null);
  });
});

describe('transactions', () => {
  it('signs and colors by direction', () => {
    const expense = toTransactionRow(
      tx({ category: { id: 'rest', name: 'Restaurants', parentId: 'food' } }),
      CATEGORIES,
    );
    assert.equal(expense.amount, '-$80.00');
    assert.equal(expense.variant, 'expense');
    assert.equal(expense.category, 'Restaurantes');
    assert.equal(expense.time, 'Nómina · 14:32');
    assert.equal(expense.iconKey, 'food');

    const income = toTransactionRow(
      tx({
        type: 'income',
        amount: 15000,
        merchantName: null,
        description: 'Nómina',
      }),
      CATEGORIES,
    );
    assert.equal(income.amount, '+$15,000.00');
    assert.equal(income.iconKey, 'income');

    const adjustment = toTransactionRow(
      tx({ type: 'adjustment', amount: 500, merchantName: 'PAGO GRACIAS' }),
      CATEGORIES,
    );
    assert.equal(adjustment.amount, '$500.00');
    assert.equal(adjustment.variant, 'neutral');
  });

  it('reads transfer direction from the API description', () => {
    const out = tx({
      type: 'transfer',
      merchantName: null,
      description: 'Transfer to Ahorro (outgoing)',
    });
    assert.equal(direction(out), 'out');
    assert.equal(
      toTransactionRow(
        { ...out, description: 'Pago tarjeta (outgoing)' },
        CATEGORIES,
      ).title,
      'Pago tarjeta',
    );
    assert.equal(
      toTransactionRow(out, CATEGORIES).title,
      'Transferencia a Ahorro',
    );
    assert.equal(
      direction({ ...out, description: 'Transfer to Ahorro (incoming)' }),
      'in',
    );
  });

  it('shows bank dates without a time and groups by day, newest first', () => {
    const rows = [
      toTransactionRow(
        tx({ id: 'b', txnDate: '2026-10-13T00:00:00.000Z' }),
        CATEGORIES,
      ),
      toTransactionRow(tx({ id: 'a' }), CATEGORIES),
      toTransactionRow(
        tx({ id: 'c', txnDate: '2026-10-14T00:00:00.000Z' }),
        CATEGORIES,
      ),
    ];
    assert.equal(rows[0]!.time, 'Nómina');
    assert.equal(
      toTransactionRow(
        tx({ txnDate: '2026-10-13T00:00:00.000Z' }),
        CATEGORIES,
        {
          withDate: true,
        },
      ).time,
      'Nómina · 13 oct',
    );
    const groups = groupByDay(rows, '2026-10-14');
    assert.deepEqual(
      groups.map((g) => [g.heading, g.rows.map((r) => r.id)]),
      [
        ['Hoy, 14 de octubre', ['a', 'c']],
        ['Ayer, 13 de octubre', ['b']],
      ],
    );
  });
});

describe('accounts', () => {
  it('separates money available from card debt, per currency', () => {
    const [mxn, usd] = summarizeBalances([
      account({ balanceCurrent: 10000 }),
      account({ id: 'c', type: 'credit', balanceCurrent: -2500.5 }),
      account({ id: 'u', currency: 'USD', balanceCurrent: 100 }),
      account({ id: 'old', balanceCurrent: 999, archived: true }),
    ]);
    assert.deepEqual(mxn, {
      currency: 'MXN',
      available: 10000,
      creditDebt: 2500.5,
      net: 7499.5,
      accounts: 2,
    });
    assert.equal(usd?.currency, 'USD');
    assert.equal(creditOwed({ balanceCurrent: 300 }), 0);
  });

  it('finds the next cut-off day, clamped to short months', () => {
    assert.equal(nextMonthlyDay('2026-10-14', 20), '2026-10-20');
    assert.equal(nextMonthlyDay('2026-10-14', 14), '2026-10-14');
    assert.equal(nextMonthlyDay('2026-10-14', 5), '2026-11-05');
    assert.equal(nextMonthlyDay('2027-01-31', 31), '2027-01-31');
    assert.equal(nextMonthlyDay('2027-02-01', 31), '2027-02-28');
  });
});

describe('payments', () => {
  const payment = (
    overrides: Partial<ApiUpcomingPayment> = {},
  ): ApiUpcomingPayment => ({
    dueDate: '2026-10-15T00:00:00.000Z',
    expectedAmount: 199,
    occurrenceId: 'o1',
    status: 'upcoming',
    recurringExpense: {
      id: 'r1',
      name: 'Netflix',
      kind: 'subscription',
      currency: 'MXN',
      accountId: null,
      isVariableAmount: false,
    },
    ...overrides,
  });

  it('highlights payments due soon and keeps paid ones closed', () => {
    const soon = toPaymentRow(payment(), '2026-10-14');
    assert.equal(soon.status, 'pending');
    assert.equal(soon.timeLabel, 'Mañana · 15 oct');
    assert.equal(soon.iconKey, 'subscriptions');
    assert.ok(soon.open);

    const later = toPaymentRow(
      payment({ dueDate: '2026-10-30T00:00:00.000Z' }),
      '2026-10-14',
    );
    assert.equal(later.status, 'scheduled');

    const paid = toPaymentRow(payment({ status: 'paid' }), '2026-10-14');
    assert.equal(paid.status, 'paid');
    assert.ok(!paid.open);

    const reminder = toPaymentRow(
      payment({
        status: null,
        occurrenceId: null,
        recurringExpense: {
          ...payment().recurringExpense,
          isVariableAmount: true,
        },
      }),
      '2026-10-14',
    );
    assert.equal(reminder.amount, '≈ $199.00');
    assert.match(reminder.timeLabel, /^Recordatorio/);
  });
});

describe('spendingByCategory', () => {
  it('adds subcategories into their parent and keeps uncategorized spending', () => {
    const rows = spendingByCategory(
      {
        totalExpenses: 1000,
        categoryBreakdown: [
          { categoryId: 'rest', categoryName: 'Restaurants', amount: 300 },
          { categoryId: 'food', categoryName: 'Food & Dining', amount: 200 },
          { categoryId: 'mine', categoryName: 'Mascotas', amount: 100 },
        ],
      },
      CATEGORIES,
    );
    assert.deepEqual(
      rows.map((r) => [r.label, r.amount, r.percent]),
      [
        ['Comida', 500, 50],
        ['Sin categoría', 400, 40],
        ['Mascotas', 100, 10],
      ],
    );
  });
});
