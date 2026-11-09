import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { testLocalizer } from '../i18n/testing';
import {
  initialLinkChoice,
  linkIntro,
  toRecurringLinkView,
  type ApiRecurringLinkOptions,
} from './links';

const es = testLocalizer('es');

const options: ApiRecurringLinkOptions = {
  month: '2026-10',
  months: ['2026-09', '2026-10', '2026-11'],
  proposedId: 'minecraft',
  expenses: [
    {
      id: 'minecraft',
      name: 'Minecraft Realm',
      kind: 'subscription',
      amount: 142.33,
      active: true,
      categoryId: 'c1',
      nameMatches: false,
      fits: true,
      slots: [
        {
          month: '2026-10',
          dueDate: '2026-10-15T00:00:00.000Z',
          status: 'unscheduled',
          expectedAmount: 142.33,
        },
        {
          month: '2026-11',
          dueDate: '2026-11-15T00:00:00.000Z',
          status: 'pending',
          expectedAmount: 142.33,
        },
      ],
    },
    {
      id: 'crunchy',
      name: 'Crunchyroll',
      kind: 'subscription',
      amount: 159,
      active: true,
      categoryId: null,
      nameMatches: false,
      fits: true,
      slots: [
        {
          month: '2026-10',
          dueDate: '2026-10-28T00:00:00.000Z',
          status: 'paid_without_movement',
          expectedAmount: 159,
        },
      ],
    },
    {
      id: 'termius',
      name: 'Termius',
      kind: 'subscription',
      amount: 53,
      active: true,
      categoryId: null,
      nameMatches: false,
      fits: false,
      slots: [
        {
          month: '2026-10',
          dueDate: '2026-10-14T00:00:00.000Z',
          status: 'linked',
          expectedAmount: 53,
        },
        {
          month: '2026-11',
          dueDate: '2026-11-14T00:00:00.000Z',
          status: 'missed',
          expectedAmount: 53,
        },
      ],
    },
  ],
};

describe('linking an expense to a recurring payment', () => {
  it("suggests the fitting ones in the expense's month and lists the rest", () => {
    const view = toRecurringLinkView(options, '2026-10', '', 'MXN', es);
    assert.deepEqual(
      view.suggested.map((r) => [r.name, r.detail]),
      [
        ['Minecraft Realm', 'Se registrará el pago del 15 oct · $142.33'],
        ['Crunchyroll', 'Pagado sin movimiento · 28 oct · $159.00'],
      ],
    );
    assert.deepEqual(view.others, [
      {
        id: 'termius',
        name: 'Termius',
        detail: 'Ya pagado con otro movimiento · 14 oct',
        disabled: true,
        suggested: false,
      },
    ]);
    assert.equal(view.months.length, 3);
    assert.deepEqual(initialLinkChoice(options), {
      id: 'minecraft',
      month: '2026-10',
    });
  });

  it('shows another month, and searches every one by name', () => {
    const november = toRecurringLinkView(options, '2026-11', '', 'MXN', es);
    assert.equal(november.suggested.length, 0);
    assert.deepEqual(
      november.others.map((r) => r.name),
      ['Crunchyroll', 'Minecraft Realm', 'Termius'],
    );
    assert.equal(
      november.others.find((r) => r.id === 'termius')?.detail,
      'Vencido el 14 nov · $53.00',
    );
    const found = toRecurringLinkView(options, '2026-10', 'crunchy', 'MXN', es);
    assert.deepEqual(
      [...found.suggested, ...found.others].map((r) => r.id),
      ['crunchy'],
    );
  });

  it('names the expense without its sign', () => {
    assert.deepEqual(
      linkIntro(
        { amount: -141, currency: 'MXN', txnDate: '2026-10-23T00:00:00.000Z' },
        es,
      ),
      { date: '23 oct', amount: '$141.00' },
    );
  });
});
