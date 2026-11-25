import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import type { ApiAccount } from '@finnit/core/finance/types';
import { testLocalizer } from '@finnit/core/i18n/testing';
import type {
  ApiRecurringExpense,
  ApiRecurringPayment,
} from '@finnit/core/recurring/types';
import {
  WIDGET_QUERY,
  widgetData,
  widgetVariables,
} from '@finnit/core/widget/request';
import {
  HIDDEN_AMOUNT,
  buildWidgetProps,
  buildWidgetTimeline,
  midnightOf,
  glassGradient,
  signedOutWidgetProps,
  type WidgetColors,
} from '@finnit/core/widget/view';

const es = testLocalizer('es');
const TODAY = '2026-11-12'; // a Thursday

const COLOR: WidgetColors = {
  background: '#fff',
  gradient: [],
  text: '#000',
  muted: '#666',
  accent: '#0ff',
  accentText: '#000',
  pending: '#00f',
  overdue: '#f00',
  paid: '#0f0',
  card: '#909',
};
const colors = { light: COLOR, dark: COLOR };

const expense = (
  overrides: Partial<ApiRecurringExpense> = {},
): ApiRecurringExpense => ({
  id: 'netflix',
  name: 'Netflix',
  kind: 'subscription',
  trackingMode: 'manual',
  frequency: 'monthly',
  interval: 1,
  startDate: '2026-01-05T00:00:00.000Z',
  endDate: null,
  amount: 219,
  isVariableAmount: false,
  currency: 'MXN',
  accountId: null,
  categoryId: null,
  merchantPattern: null,
  installmentsTotal: null,
  installmentsPaid: 0,
  active: true,
  notes: null,
  nextDueDate: null,
  monthlyCost: 219,
  ...overrides,
});

const payment = (
  day: string,
  name: string,
  overrides: Partial<ApiRecurringPayment> = {},
  expenseOverrides: Partial<ApiRecurringExpense> = {},
): ApiRecurringPayment => ({
  dueDate: `${day}T00:00:00.000Z`,
  expectedAmount: 219,
  occurrenceId: `o-${name}-${day}`,
  status: 'upcoming',
  recurringExpense: expense({ id: name, name, ...expenseOverrides }),
  ...overrides,
});

const card: ApiAccount = {
  id: 'tdc',
  name: 'Oro',
  type: 'credit',
  currency: 'MXN',
  balanceCurrent: -500,
  archived: false,
  metadata: {
    bank: 'BBVA',
    last4: '1234',
    creditLimit: null,
    nickname: null,
  },
  creditCardTerms: { statementDay: 20, paymentDueDay: 28 },
} as ApiAccount;

const data = {
  payments: [
    payment(
      '2026-11-20',
      'Luz',
      {},
      { kind: 'utility', isVariableAmount: true },
    ),
    payment('2026-11-05', 'Gym', { status: 'paid' }),
    payment('2026-11-10', 'Renta', {}, { kind: 'housing' }),
    payment('2026-11-12', 'Spotify'),
    payment('2026-11-13', 'Seguro', {}, { kind: 'insurance' }),
    payment('2026-11-25', 'Internet'),
    payment('2026-11-26', 'Agua', { status: 'skipped' }),
    payment('2026-12-03', 'Diciembre'),
  ],
  accounts: [card],
};

describe('widget request', () => {
  it('asks for this month and the next', () => {
    assert.deepEqual(widgetVariables(TODAY), {
      from: '2026-11-01T00:00:00.000Z',
      to: '2026-12-31T23:59:59.999Z',
    });
    assert.match(WIDGET_QUERY, /upcomingPayments\(from: \$from, to: \$to\)/);
  });

  it('flattens the accounts', () => {
    const result = widgetData({
      upcomingPayments: [],
      accounts: { edges: [{ node: card }] } as never,
    });
    assert.deepEqual(result.accounts, [card]);
  });
});

describe('buildWidgetProps', () => {
  const props = buildWidgetProps(
    data,
    { today: TODAY, hideAmounts: false, colors },
    es,
  );

  it('lays out the month Monday first', () => {
    assert.equal(props.monthLabel, 'Noviembre 2026');
    assert.deepEqual(props.weekdays, ['L', 'M', 'M', 'J', 'V', 'S', 'D']);
    // November 2026 starts on a Sunday: six padding days, six weeks.
    assert.equal(props.weeks.length, 6);
    assert.equal(props.weeks[0]!.filter((d) => d.label === '').length, 6);
    assert.ok(props.weeks.every((w) => w.length === 7));
    const today = props.weeks.flat().find((d) => d.today);
    assert.equal(today?.label, '12');
  });

  it('marks each day with its most urgent payment', () => {
    const mark = (day: string) =>
      props.weeks.flat().find((d) => d.key === day)?.mark;
    assert.equal(mark('2026-11-05'), 'paid');
    assert.equal(mark('2026-11-10'), 'overdue');
    assert.equal(mark('2026-11-20'), 'pending');
    assert.equal(mark('2026-11-26'), 'none'); // skipped
    assert.equal(mark('2026-11-28'), 'card');
  });

  it('lists what is still to pay in due order, overdue first', () => {
    assert.deepEqual(
      props.payments.map((p) => [p.name, p.when]),
      [
        ['Renta', 'Vencido · 10 nov'],
        ['Spotify', 'Hoy'],
        ['Seguro', 'Mañana'],
      ],
    );
    assert.equal(props.payments[0]!.overdue, true);
    // Five open: three rows and "+2 más".
    assert.equal(props.moreLabel, '+2 más');
  });

  it('shows every row when they fit', () => {
    const few = buildWidgetProps(
      { ...data, payments: data.payments.slice(0, 4) },
      { today: TODAY, hideAmounts: false, colors },
      es,
    );
    assert.equal(few.payments.length, 3);
    assert.equal(few.moreLabel, '');
  });

  it('masks amounts with "Ocultar montos"', () => {
    const hidden = buildWidgetProps(
      data,
      { today: TODAY, hideAmounts: true, colors },
      es,
    );
    assert.ok(hidden.payments.every((p) => p.amount === HIDDEN_AMOUNT));
    assert.notEqual(props.payments[1]!.amount, HIDDEN_AMOUNT);
  });

  it('opens the calendar on tap', () => {
    assert.equal(props.url, 'finnitapp:///calendar');
  });
});

describe('buildWidgetTimeline', () => {
  const now = new Date('2026-11-12T18:00:00.000Z');
  const entries = buildWidgetTimeline(
    data,
    { now, today: TODAY, hideAmounts: false, colors },
    es,
  );

  it('schedules one entry per midnight until a week into next month', () => {
    assert.equal(entries[0]!.date, now);
    assert.deepEqual(entries[1]!.date, midnightOf('2026-11-13'));
    assert.deepEqual(
      entries.at(-1)!.date,
      new Date('2026-12-07T06:00:00.000Z'),
    );
    // Nov 12 (now) + Nov 13…30 (18) + Dec 1…7 (7).
    assert.equal(entries.length, 26);
  });

  it('turns the month by itself', () => {
    const december = entries.find(
      (e) => e.date.getTime() === midnightOf('2026-12-01').getTime(),
    )!;
    assert.equal(december.props.monthLabel, 'Diciembre 2026');
    assert.deepEqual(
      december.props.payments.map((p) => p.name),
      ['Diciembre'],
    );
  });
});

describe('signedOutWidgetProps', () => {
  it('carries no data', () => {
    const props = signedOutWidgetProps(colors, es);
    assert.equal(props.status, 'signedOut');
    assert.deepEqual(props.payments, []);
    assert.ok(props.message.length > 0);
  });
});

/** Paths to null/undefined values (UserDefaults can't store them). */
function nullPaths(value: unknown, path = 'props'): string[] {
  if (value === null || value === undefined) return [path];
  if (Array.isArray(value))
    return value.flatMap((item, i) => nullPaths(item, `${path}[${i}]`));
  if (typeof value === 'object')
    return Object.entries(value).flatMap(([key, item]) =>
      nullPaths(item, `${path}.${key}`),
    );
  return [];
}

describe('widget props', () => {
  it('never carry null (the App Group can only store property lists)', () => {
    const few = buildWidgetProps(
      { ...data, payments: [] },
      { today: TODAY, hideAmounts: false, colors },
      es,
    );
    const timeline = buildWidgetTimeline(
      data,
      { now: new Date(), today: TODAY, hideAmounts: true, colors },
      es,
    );
    assert.deepEqual(
      [
        few,
        signedOutWidgetProps(colors, es),
        ...timeline.map((e) => e.props),
      ].flatMap((p) => nullPaths(p)),
      [],
    );
  });
});

describe('glassGradient', () => {
  it('mixes each blob into the background, left to right', () => {
    assert.deepEqual(
      glassGradient('#ffffff', [
        { cx: 0.9, color: 'rgb(0, 0, 0)', opacity: 0.5 },
        { cx: 0.1, color: 'rgb(255, 0, 0)', opacity: 1 },
      ]),
      ['#ff0000', '#808080'],
    );
  });

  it('is empty without blobs (a solid background)', () => {
    assert.deepEqual(glassGradient('#ffffff', []), []);
  });
});
