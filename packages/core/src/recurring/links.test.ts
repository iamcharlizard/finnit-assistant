import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { testLocalizer } from '../i18n/testing';
import { toRecurringLinkOptions } from './links';

describe('linking an expense to a recurring payment', () => {
  it('lists the payments with their due date and selects the proposed one', () => {
    const { options, initial } = toRecurringLinkOptions(
      [
        {
          occurrenceId: 'o1',
          recurringExpenseId: 'r1',
          name: 'Netflix',
          kind: 'subscription',
          dueDate: '2026-11-07T00:00:00.000Z',
          expectedAmount: 219,
          status: 'upcoming',
          categoryId: 'c1',
          proposed: true,
        },
        {
          occurrenceId: 'o2',
          recurringExpenseId: 'r2',
          name: 'Gimnasio',
          kind: 'membership',
          dueDate: '2026-10-30T00:00:00.000Z',
          expectedAmount: 600,
          status: 'missed',
          categoryId: null,
          proposed: false,
        },
        {
          occurrenceId: 'o3',
          recurringExpenseId: 'r3',
          name: 'Luz',
          kind: 'utility',
          dueDate: '2026-11-05T00:00:00.000Z',
          expectedAmount: 450,
          status: 'paid',
          categoryId: null,
          proposed: false,
        },
      ],
      'MXN',
      testLocalizer('es'),
    );
    assert.equal(initial, 'o1');
    assert.deepEqual(
      options.map((o) => o.detail),
      [
        'Vence el 7 nov · $219.00',
        'Vencido el 30 oct · $600.00',
        'Pagado sin movimiento · 5 nov · $450.00',
      ],
    );
  });
});
