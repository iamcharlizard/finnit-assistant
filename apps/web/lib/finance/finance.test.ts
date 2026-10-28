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
  shortDate,
  timeOf,
  todayKey,
  weekdayIndex,
} from './dates';
import { testLocalizer } from '@/lib/i18n/testing';
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
  displayName: 'OXXO',
  isPrivate: false,
  isPending: false,
  source: 'manual',
  accountId: 'a1',
  account: { id: 'a1', name: 'Nómina', type: 'debit' },
  category: null,
  ...overrides,
});

const es = testLocalizer('es');
const en = testLocalizer('en');

const CATEGORIES = indexCategories([
  { id: 'food', name: 'Comida', parentId: null },
  { id: 'rest', name: 'Restaurantes', parentId: 'food' },
  { id: 'mine', name: 'Mascotas', parentId: null },
]);

describe('formatMoney', () => {
  it('formats the same text everywhere', () => {
    assert.equal(formatMoney(1234.5, 'MXN', 'es'), '$1,234.50');
    assert.equal(formatMoney(-80, 'MXN', 'es'), '-$80.00');
    assert.equal(
      formatMoney(1200, 'MXN', 'es', { sign: 'always' }),
      '+$1,200.00',
    );
    assert.equal(formatMoney(-5, 'MXN', 'es', { sign: 'never' }), '$5.00');
    assert.equal(formatMoney(0, 'MXN', 'es', { sign: 'always' }), '$0.00');
    assert.equal(formatMoney(-0.001, 'MXN', 'es'), '$0.00');
    assert.equal(formatMoney(1234567.891, 'USD', 'es'), 'US$1,234,567.89');
    assert.equal(
      formatMoney(20000, 'MXN', 'es', { wholeUnits: true }),
      '$20,000',
    );
    assert.equal(formatMoney(10, 'COP', 'es'), 'COP 10.00');
    assert.equal(formatMoney(-1234.5, 'MXN', 'en'), '-$1,234.50');
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
    assert.equal(monthLabel({ year: 2026, month: 10 }, 'es'), 'Octubre 2026');
    assert.equal(monthLabel({ year: 2026, month: 10 }, 'en'), 'October 2026');
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
    assert.equal(
      dayHeading('2026-10-14', '2026-10-14', 'es'),
      'Hoy, 14 de octubre',
    );
    assert.equal(
      dayHeading('2026-10-13', '2026-10-14', 'es'),
      'Ayer, 13 de octubre',
    );
    assert.equal(
      dayHeading('2025-12-01', '2026-10-14', 'es'),
      'Lunes, 1 de diciembre de 2025',
    );
    assert.equal(
      relativeDayLabel('2026-10-17', '2026-10-14', 'es'),
      'En 3 días',
    );
    assert.equal(relativeDayLabel('2026-10-15', '2026-10-14', 'es'), 'Mañana');
    assert.equal(
      relativeDayLabel('2026-10-12', '2026-10-14', 'es'),
      'Hace 2 días',
    );
  });

  it('labels days in English', () => {
    assert.equal(
      dayHeading('2026-10-14', '2026-10-14', 'en'),
      'Today, October 14',
    );
    assert.equal(
      dayHeading('2025-12-01', '2026-10-14', 'en'),
      'Monday, December 1, 2025',
    );
    assert.equal(shortDate('2026-10-15', 'en'), 'Oct 15');
    assert.equal(
      relativeDayLabel('2026-10-17', '2026-10-14', 'en'),
      'In 3 days',
    );
    assert.equal(
      relativeDayLabel('2026-10-12', '2026-10-14', 'en'),
      '2 days ago',
    );
  });
});

describe('categories', () => {
  it('shows the API’s (already localized) name, or "no category"', () => {
    assert.equal(categoryLabel('Comida', es.t), 'Comida');
    assert.equal(categoryLabel(null, es.t), 'Sin categoría');
    assert.equal(categoryLabel('', en.t), 'Uncategorized');
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
      tx({ category: { id: 'rest', name: 'Restaurantes', parentId: 'food' } }),
      CATEGORIES,
      es,
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
      es,
    );
    assert.equal(income.amount, '+$15,000.00');
    assert.equal(income.iconKey, 'income');

    const adjustment = toTransactionRow(
      tx({ type: 'adjustment', amount: 500, merchantName: 'PAGO GRACIAS' }),
      CATEGORIES,
      es,
    );
    assert.equal(adjustment.amount, '$500.00');
    assert.equal(adjustment.variant, 'neutral');
  });

  it('shows the alias of a renamed movement, with a lock when private', () => {
    const rule = toTransactionRow(
      tx({
        merchantName: 'CLIP MX*XYZ 2231',
        displayName: 'Tacos Don Güero',
        aliasId: 'al1',
      }),
      CATEGORIES,
      es,
    );
    assert.equal(rule.title, 'Tacos Don Güero');
    assert.equal(rule.isPrivate, false);

    const own = toTransactionRow(
      tx({ displayName: 'Cena con Ana', hasOwnAlias: true }),
      CATEGORIES,
      es,
    );
    assert.equal(own.title, 'Cena con Ana');

    const secret = toTransactionRow(
      tx({ merchantName: null, displayName: 'Regalo', isPrivate: true }),
      CATEGORIES,
      es,
    );
    assert.equal(secret.title, 'Regalo');
    assert.equal(secret.isPrivate, true);

    // Not aliased: the usual rules (Initial balance, transfers) still apply.
    assert.equal(
      toTransactionRow(
        tx({
          merchantName: null,
          description: 'Initial balance',
          displayName: 'Initial balance',
        }),
        CATEGORIES,
        es,
      ).title,
      'Saldo inicial',
    );
    assert.equal(
      toTransactionRow(
        tx({ merchantName: null, description: null, displayName: 'Netflix' }),
        CATEGORIES,
        es,
      ).title,
      'Netflix',
    );
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
        es,
      ).title,
      'Pago tarjeta',
    );
    assert.equal(
      toTransactionRow(out, CATEGORIES, es).title,
      'Transferencia a Ahorro',
    );
    assert.equal(
      toTransactionRow(out, CATEGORIES, en).title,
      'Transfer to Ahorro',
    );
    assert.equal(toTransactionRow(out, CATEGORIES, en).category, 'Transfer');
    assert.equal(
      direction({ ...out, description: 'Transfer to Ahorro (incoming)' }),
      'in',
    );
  });

  it('prefers the transfer side the API reports over the description', () => {
    const base = tx({
      type: 'transfer',
      merchantName: null,
      description: 'Pago de tarjeta Oro',
    });
    assert.equal(direction(base), 'unknown');
    assert.equal(direction({ ...base, transferDirection: 'out' }), 'out');
    assert.equal(direction({ ...base, transferDirection: 'in' }), 'in');
    assert.equal(
      toTransactionRow({ ...base, transferDirection: 'out' }, CATEGORIES, es)
        .title,
      'Pago de tarjeta Oro',
    );
  });

  it('shows bank dates without a time and groups by day, newest first', () => {
    const rows = [
      toTransactionRow(
        tx({ id: 'b', txnDate: '2026-10-13T00:00:00.000Z' }),
        CATEGORIES,
        es,
      ),
      toTransactionRow(tx({ id: 'a' }), CATEGORIES, es),
      toTransactionRow(
        tx({ id: 'c', txnDate: '2026-10-14T00:00:00.000Z' }),
        CATEGORIES,
        es,
      ),
    ];
    assert.equal(rows[0]!.time, 'Nómina');
    assert.equal(
      toTransactionRow(
        tx({ txnDate: '2026-10-13T00:00:00.000Z' }),
        CATEGORIES,
        es,
        {
          withDate: true,
        },
      ).time,
      'Nómina · 13 oct',
    );
    const groups = groupByDay(rows, '2026-10-14', 'es');
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
    const soon = toPaymentRow(payment(), '2026-10-14', es);
    assert.equal(soon.status, 'pending');
    assert.equal(soon.timeLabel, 'Mañana · 15 oct');
    assert.equal(soon.iconKey, 'subscriptions');
    assert.ok(soon.open);

    const later = toPaymentRow(
      payment({ dueDate: '2026-10-30T00:00:00.000Z' }),
      '2026-10-14',
      es,
    );
    assert.equal(later.status, 'scheduled');

    const paid = toPaymentRow(payment({ status: 'paid' }), '2026-10-14', es);
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
      es,
    );
    assert.equal(reminder.amount, '≈ $199.00');
    assert.match(reminder.timeLabel, /^Recordatorio/);
    assert.equal(
      toPaymentRow(payment(), '2026-10-14', en).timeLabel,
      'Tomorrow · Oct 15',
    );
  });
});

describe('spendingByCategory', () => {
  it('adds subcategories into their parent and keeps uncategorized spending', () => {
    const rows = spendingByCategory(
      {
        totalExpenses: 1000,
        categoryBreakdown: [
          { categoryId: 'rest', categoryName: 'Restaurantes', amount: 300 },
          { categoryId: 'food', categoryName: 'Comida', amount: 200 },
          { categoryId: 'mine', categoryName: 'Mascotas', amount: 100 },
        ],
      },
      CATEGORIES,
      es.t,
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
