import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import type { ApiAccount } from '@/lib/finance/types';
import { GraphqlRequestError } from '@/lib/graphql/client';
import { testLocalizer } from '@/lib/i18n/testing';
import {
  ACCEPT_SUGGESTION_MUTATION,
  CREATE_MUTATION,
  UPDATE_MUTATION,
  recurringErrorMessage,
  saveRecurring,
} from './api';
import { filterExpenses, kindFilterOptions } from './filters';
import {
  buildAcceptInput,
  buildCreateInput,
  buildUpdateInput,
  formOfExpense,
  formOfSuggestion,
  newRecurringForm,
  validateRecurringForm,
  type RecurringForm,
} from './form';
import {
  parseDateParam,
  parseViewParam,
  periodLabel,
  recurringHref,
  shiftDate,
  visibleRange,
} from './range';
import { confidencePercent, toSuggestionCard } from './suggestions';
import type {
  ApiRecurringExpense,
  ApiRecurringPayment,
  ApiRecurringSuggestion,
} from './types';
import {
  buildRecurringView,
  cardDatesIn,
  paymentActions,
  paymentStatus,
  toCalendarEvent,
  toPaymentItem,
} from './view';

const es = testLocalizer('es');
const en = testLocalizer('en');
const TODAY = '2026-10-13'; // a Tuesday

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
  accountId: 'tdc',
  categoryId: null,
  merchantPattern: 'NETFLIX',
  installmentsTotal: null,
  installmentsPaid: 0,
  active: true,
  notes: null,
  nextDueDate: '2026-11-05T00:00:00.000Z',
  monthlyCost: 219,
  ...overrides,
});

const payment = (
  dueDay: string,
  overrides: Partial<ApiRecurringPayment> = {},
  expenseOverrides: Partial<ApiRecurringExpense> = {},
): ApiRecurringPayment => ({
  dueDate: `${dueDay}T00:00:00.000Z`,
  expectedAmount: 219,
  occurrenceId: `o-${dueDay}`,
  status: 'upcoming',
  recurringExpense: expense(expenseOverrides),
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
    nickname: 'Mi Oro',
  },
  creditCardTerms: { statementDay: 20, paymentDueDay: 31 },
};

const suggestion = (
  overrides: Partial<ApiRecurringSuggestion> = {},
): ApiRecurringSuggestion => ({
  fingerprint: 'fp-cfe',
  merchant: 'cfe suministrador',
  suggestedName: 'Luz (CFE)',
  kind: 'utility',
  category: { id: 'cat-luz', name: 'Luz' },
  frequency: 'bimonthly',
  interval: 1,
  amount: 480.456,
  isVariableAmount: true,
  currency: 'MXN',
  account: { id: 'tdc', name: 'Oro', metadata: { nickname: 'Mi Oro' } },
  nextDueDate: '2026-11-20T00:00:00.000Z',
  occurrences: [
    { transactionId: 't1', date: '2026-05-20T00:00:00.000Z', amount: 455 },
    { transactionId: 't3', date: '2026-09-21T00:00:00.000Z', amount: 512 },
    { transactionId: 't2', date: '2026-07-19T00:00:00.000Z', amount: 480 },
  ],
  confidence: 0.86,
  classifiedBy: 'ai',
  ...overrides,
});

describe('range per view', () => {
  it('reads the view and date params with safe fallbacks', () => {
    assert.equal(parseViewParam('week'), 'week');
    assert.equal(parseViewParam('year'), 'month');
    assert.equal(parseViewParam(undefined), 'month');
    assert.equal(parseDateParam({ date: '2026-02-28' }, TODAY), '2026-02-28');
    assert.equal(parseDateParam({ date: '2026-02-30' }, TODAY), TODAY);
    // The old calendar's ?month=: its first day, or today in this month.
    assert.equal(parseDateParam({ month: '2026-12' }, TODAY), '2026-12-01');
    assert.equal(parseDateParam({ month: '2026-10' }, TODAY), TODAY);
    assert.equal(parseDateParam({ month: '1999-01' }, TODAY), TODAY);
  });

  it('computes the visible days of each view (weeks start on Monday)', () => {
    assert.deepEqual(visibleRange('day', TODAY), {
      start: TODAY,
      end: TODAY,
    });
    assert.deepEqual(visibleRange('week', TODAY), {
      start: '2026-10-12',
      end: '2026-10-18',
    });
    // A Sunday belongs to the week that started the Monday before.
    assert.deepEqual(visibleRange('week', '2026-11-01'), {
      start: '2026-10-26',
      end: '2026-11-01',
    });
    assert.deepEqual(visibleRange('month', '2024-02-10'), {
      start: '2024-02-01',
      end: '2024-02-29',
    });
  });

  it('moves to the previous and next period', () => {
    assert.equal(shiftDate('day', '2026-10-31', 1), '2026-11-01');
    assert.equal(shiftDate('week', TODAY, -1), '2026-10-06');
    assert.equal(shiftDate('month', '2026-01-31', 1), '2026-02-28');
    assert.equal(shiftDate('month', '2026-01-15', -1), '2025-12-15');
    assert.equal(
      recurringHref({ view: 'month', date: TODAY }),
      '/recurring?date=2026-10-13',
    );
    assert.equal(
      recurringHref({ view: 'week', date: TODAY }),
      '/recurring?view=week&date=2026-10-13',
    );
  });

  it('labels the period', () => {
    assert.equal(periodLabel('month', TODAY, TODAY, 'es'), 'Octubre 2026');
    assert.equal(periodLabel('week', TODAY, TODAY, 'es'), '12–18 oct');
    assert.equal(periodLabel('week', TODAY, TODAY, 'en'), 'Oct 12–18');
    assert.equal(
      periodLabel('week', '2026-10-28', TODAY, 'es'),
      '26 oct – 1 nov',
    );
    assert.equal(periodLabel('day', TODAY, TODAY, 'es'), '13 de octubre');
  });
});

describe('payments and calendar events', () => {
  it('shows an upcoming payment past its date as overdue', () => {
    assert.deepEqual(paymentStatus(payment('2026-10-12'), TODAY), {
      status: 'missed',
      overdue: true,
    });
    assert.deepEqual(paymentStatus(payment(TODAY), TODAY), {
      status: 'upcoming',
      overdue: false,
    });
    assert.deepEqual(
      paymentStatus(payment('2026-10-01', { status: 'missed' }), TODAY),
      { status: 'missed', overdue: false },
    );
    assert.deepEqual(
      paymentStatus(
        payment('2026-10-01', { status: null, occurrenceId: null }),
        TODAY,
      ),
      { status: 'reminder', overdue: false },
    );
  });

  it('offers the actions each status allows', () => {
    assert.deepEqual(paymentActions('o1', 'upcoming'), ['pay', 'skip']);
    assert.deepEqual(paymentActions('o1', 'missed'), ['pay', 'skip']);
    assert.deepEqual(paymentActions('o1', 'paid'), ['reopen']);
    assert.deepEqual(paymentActions('o1', 'skipped'), ['reopen']);
    assert.deepEqual(paymentActions(null, 'reminder'), []);
  });

  it('maps a payment to a side-panel item and a calendar event', () => {
    const item = toPaymentItem(
      payment('2026-10-14', {}, { isVariableAmount: true }),
      new Map([['tdc', card]]),
      TODAY,
      es,
    );
    assert.equal(item.accountLabel, 'Mi Oro');
    assert.equal(item.amountLabel, '≈ $219.00');
    assert.equal(item.dateLabel, 'Mañana · 14 oct');
    assert.equal(item.open, true);
    assert.deepEqual(toCalendarEvent(item), {
      id: 'o-2026-10-14',
      date: '2026-10-14',
      title: 'Netflix',
      amountLabel: '≈ $219.00',
      status: 'upcoming',
      color: '#a855f7',
    });
    const reminder = toPaymentItem(
      payment('2026-10-20', { occurrenceId: null, status: null }),
      new Map(),
      TODAY,
      es,
    );
    assert.equal(reminder.key, 'netflix:2026-10-20');
    assert.equal(reminder.accountLabel, null);
    assert.deepEqual(reminder.actions, []);
  });

  it('builds the period: in-range payments, totals and card dates', () => {
    const view = buildRecurringView(
      {
        payments: [
          payment('2026-10-05', { status: 'paid' }),
          payment('2026-10-12', { expectedAmount: 100 }),
          payment('2026-10-13', { status: 'skipped', expectedAmount: 50 }),
          payment(
            '2026-10-16',
            { occurrenceId: null, status: null, expectedAmount: 480 },
            { id: 'cfe', name: 'CFE', kind: 'utility' },
          ),
          payment('2026-10-20', {
            expectedAmount: 10,
            recurringExpense: expense({ currency: 'USD' }),
          }),
        ],
        expenses: [
          expense({ id: 'b', name: 'Zeta', active: false }),
          expense({ id: 'a', name: 'Agua', monthlyCost: 100 }),
        ],
        accounts: [card],
        categories: [],
        monthlyTotals: [{ currency: 'MXN', monthlyCost: 319 }],
      },
      { view: 'week', date: TODAY, today: TODAY },
      es,
    );
    assert.deepEqual(
      view.payments.map((p) => [p.day, p.status]),
      [
        ['2026-10-12', 'missed'],
        ['2026-10-13', 'skipped'],
        ['2026-10-16', 'reminder'],
      ],
    );
    assert.equal(view.events.length, 3);
    // Open: the overdue 100 and the 480 reminder; skipped isn't to pay.
    assert.equal(view.totals.toPay, '$580.00');
    assert.equal(view.totals.toPayCount, 2);
    assert.equal(view.totals.paid, '$0.00');
    assert.equal(view.totals.fixedMonthly, '$319.00');
    assert.equal(view.totals.activeCount, 1);
    assert.deepEqual(
      view.expenses.map((e) => e.name),
      ['Agua', 'Zeta'],
    );
    assert.equal(view.prevHref, '/recurring?view=week&date=2026-10-06');
    assert.equal(view.periodLabel, '12–18 oct');
    // The week has no card date; October has the cut-off on the 20th.
    assert.deepEqual(view.cardDates, []);
    assert.deepEqual(
      cardDatesIn([card], visibleRange('month', '2026-11-01'), es.t).map(
        (c) => [c.day, c.label],
      ),
      [
        ['2026-11-20', 'Corte de Mi Oro'],
        ['2026-11-30', 'Límite de pago de Mi Oro'],
      ],
    );
  });

  it('describes each expense of the list', () => {
    const view = buildRecurringView(
      {
        payments: [],
        expenses: [
          expense({
            id: 'tv',
            name: 'Pantalla',
            kind: 'installment',
            frequency: 'monthly',
            interval: 1,
            installmentsTotal: 12,
            installmentsPaid: 3,
            amount: 1000,
            monthlyCost: 1000,
            categoryId: 'c1',
          }),
          expense({
            frequency: 'weekly',
            interval: 2,
            monthlyCost: 474.5,
          }),
        ],
        accounts: [card],
        categories: [{ id: 'c1', name: 'Compras', parentId: null, key: null }],
        monthlyTotals: [],
      },
      { view: 'month', date: TODAY, today: TODAY },
      en,
    );
    const [netflix, tv] = view.expenses;
    assert.equal(netflix!.frequencyLabel, 'Every 2 weeks');
    assert.equal(netflix!.monthlyLabel, '≈ $474.50 a month');
    assert.equal(netflix!.nextDueLabel, 'Next: In 23 days · Nov 5');
    assert.deepEqual(tv!.installments, { paid: 3, total: 12, percent: 25 });
    assert.equal(tv!.categoryLabel, 'Compras');
    assert.equal(tv!.accountLabel, 'Mi Oro');
  });

  it('filters the list by kind and status', () => {
    const items = [
      { kind: 'utility' as const, active: true },
      { kind: 'subscription' as const, active: false },
      { kind: 'subscription' as const, active: true },
    ];
    assert.deepEqual(kindFilterOptions(items), ['subscription', 'utility']);
    assert.equal(
      filterExpenses(items, { kind: 'all', status: 'active' }).length,
      2,
    );
    assert.equal(
      filterExpenses(items, { kind: 'subscription', status: 'paused' }).length,
      1,
    );
    assert.equal(
      filterExpenses(items, { kind: 'all', status: 'all' }).length,
      3,
    );
  });
});

describe('recurring form', () => {
  const valid = (patch: Partial<RecurringForm> = {}): RecurringForm => ({
    ...newRecurringForm({ today: TODAY }),
    name: ' Netflix ',
    amount: '1,219.5',
    ...patch,
  });

  it('validates every field', () => {
    assert.deepEqual(validateRecurringForm(valid()), {});
    assert.deepEqual(
      validateRecurringForm(
        valid({
          name: '  ',
          amount: '0',
          interval: '13',
          startDate: '',
          merchantPattern: 'x'.repeat(101),
        }),
      ),
      {
        name: 'nameRequired',
        amount: 'amountInvalid',
        interval: 'intervalInvalid',
        startDate: 'startDateRequired',
        merchantPattern: 'patternTooLong',
      },
    );
    assert.deepEqual(validateRecurringForm(valid({ amount: '' })), {
      amount: 'amountRequired',
    });
    assert.deepEqual(validateRecurringForm(valid({ endDate: '2026-10-01' })), {
      endDate: 'endBeforeStart',
    });
    assert.deepEqual(validateRecurringForm(valid({ kind: 'installment' })), {
      installmentsTotal: 'installmentsRequired',
    });
    assert.deepEqual(
      validateRecurringForm(
        valid({
          kind: 'installment',
          installmentsTotal: '6',
          installmentsPaid: '7',
        }),
      ),
      { installmentsPaid: 'installmentsPaidTooMany' },
    );
  });

  it('builds the create input without empty optional fields', () => {
    assert.deepEqual(
      buildCreateInput(
        valid({ merchantPattern: ' netflix.com ', accountId: 'tdc' }),
      ),
      {
        name: 'Netflix',
        kind: 'subscription',
        trackingMode: 'manual',
        frequency: 'monthly',
        interval: 1,
        startDate: '2026-10-13T00:00:00.000Z',
        amount: 1219.5,
        isVariableAmount: false,
        currency: 'MXN',
        accountId: 'tdc',
        merchantPattern: 'NETFLIX.COM',
      },
    );
    const installment = buildCreateInput(
      valid({
        kind: 'installment',
        installmentsTotal: '12',
        installmentsPaid: '',
      }),
    );
    assert.equal(installment.installmentsTotal, 12);
    assert.equal(installment.installmentsPaid, 0);
  });

  it('sends only what changed when editing (null clears a field)', () => {
    const initial = formOfExpense(
      expense({ endDate: '2027-01-05T00:00:00.000Z', notes: 'familiar' }),
    );
    assert.equal(initial.startDate, '2026-01-05');
    assert.equal(initial.amount, '219');
    assert.equal(buildUpdateInput(initial, initial), null);
    assert.deepEqual(
      buildUpdateInput(
        {
          ...initial,
          amount: '249.00',
          endDate: '',
          accountId: '',
          notes: '  ',
        },
        initial,
      ),
      { endDate: null, amount: 249, accountId: null, notes: null },
    );
  });

  it('turns a suggestion into editable defaults', () => {
    const form = formOfSuggestion(suggestion());
    assert.deepEqual(form, {
      ...form,
      name: 'Luz (CFE)',
      kind: 'utility',
      trackingMode: 'automatic',
      frequency: 'bimonthly',
      interval: '1',
      startDate: '2026-05-20',
      amount: '480.46',
      isVariableAmount: true,
      accountId: 'tdc',
      categoryId: 'cat-luz',
      merchantPattern: 'CFE SUMINISTRADOR',
    });
    assert.deepEqual(validateRecurringForm(form), {});
  });

  it('accepts a suggestion with overrides and a follow-up update', () => {
    const suggested = formOfSuggestion(suggestion());
    const same = buildAcceptInput(suggested, suggested);
    assert.equal(same.followUp, null);
    assert.equal(same.input.kind, 'utility');
    assert.equal('startDate' in same.input, false);
    assert.equal(
      buildAcceptInput({ ...suggested, startDate: '2026-11-20' }, suggested)
        .input.startDate,
      '2026-11-20T00:00:00.000Z',
    );

    const edited = buildAcceptInput(
      {
        ...suggested,
        name: 'Luz',
        kind: 'installment',
        installmentsTotal: '6',
        notes: 'casa',
      },
      suggested,
    );
    assert.equal(edited.input.name, 'Luz');
    assert.equal('kind' in edited.input, false);
    assert.deepEqual(edited.followUp, {
      installmentsTotal: 6,
      installmentsPaid: 0,
      notes: 'casa',
      kind: 'installment',
    });
  });

  it('saves through the right mutations', async () => {
    const calls: [string, Record<string, unknown> | undefined][] = [];
    const run = async <T>(
      query: string,
      variables?: Record<string, unknown>,
    ) => {
      calls.push([query, variables]);
      return { acceptRecurringSuggestion: { id: 'new' } } as T;
    };
    const suggested = formOfSuggestion(suggestion());
    await saveRecurring(
      { ...suggested, notes: 'casa' },
      { mode: 'suggestion', fingerprint: 'fp-cfe', initial: suggested },
      run,
    );
    assert.deepEqual(
      calls.map(([q, v]) => [q, v?.fingerprint ?? v?.id]),
      [
        [ACCEPT_SUGGESTION_MUTATION, 'fp-cfe'],
        [UPDATE_MUTATION, 'new'],
      ],
    );

    calls.length = 0;
    const initial = formOfExpense(expense());
    assert.equal(
      await saveRecurring(
        initial,
        { mode: 'edit', id: 'netflix', initial },
        run,
      ),
      false,
    );
    await saveRecurring(valid(), { mode: 'create' }, run);
    assert.deepEqual(
      calls.map(([q]) => q),
      [CREATE_MUTATION],
    );
  });

  it('explains API errors in the user language', () => {
    const apiError = (message: string) =>
      new GraphqlRequestError(message, 'CONFLICT', true);
    assert.equal(
      recurringErrorMessage(
        apiError('A recurring expense with this name already exists'),
        es.t,
      ),
      'Ya tienes un pago recurrente con ese nombre.',
    );
    assert.equal(
      recurringErrorMessage(
        apiError('Reopen the payment before skipping it'),
        en.t,
      ),
      'Reopen the payment before skipping it.',
    );
    assert.equal(
      recurringErrorMessage(new Error('boom'), es.t),
      'Ocurrió un error inesperado.',
    );
  });
});

describe('suggestion cards', () => {
  it('shows the evidence newest first and the confidence as a percent', () => {
    const card = toSuggestionCard(suggestion(), TODAY, es);
    assert.equal(card.amountLabel, '$480.46');
    assert.equal(card.frequencyLabel, 'Bimestral');
    assert.equal(card.accountLabel, 'Mi Oro');
    assert.equal(card.categoryLabel, 'Luz');
    assert.equal(card.nextDueLabel, '20 nov');
    assert.deepEqual(
      card.evidence.map((e) => [e.dateLabel, e.amountLabel]),
      [
        ['21 de septiembre', '$512.00'],
        ['19 de julio', '$480.00'],
        ['20 de mayo', '$455.00'],
      ],
    );
    assert.equal(card.confidence, 86);
    assert.equal(card.classifiedByAi, true);
    assert.equal(
      toSuggestionCard(suggestion({ classifiedBy: null }), TODAY, es)
        .classifiedByAi,
      false,
    );
    assert.equal(confidencePercent(73), 73);
    assert.equal(confidencePercent(Number.NaN), 0);
  });
});
