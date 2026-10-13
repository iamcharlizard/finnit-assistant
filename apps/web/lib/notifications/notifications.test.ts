import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  isUnread,
  markedRead,
  notificationHref,
  notificationWhen,
  parseNotificationFilter,
  toNotificationPage,
  type ApiNotification,
} from './view';

const n = (over: Partial<ApiNotification> = {}): ApiNotification => ({
  id: 'n-1',
  type: 'recurring',
  title: 'Netflix vence el 2026-10-15',
  message: 'Pago de Netflix: 299.00 MXN.',
  status: 'sent',
  relatedEntityId: 'rec-1:2026-10-15',
  relatedEntityType: 'recurring_expense_due',
  createdAt: '2026-10-13T15:30:00.000Z',
  ...over,
});

const today = '2026-10-13';

describe('notifications', () => {
  it('links to what they are about', () => {
    assert.equal(notificationHref(n()), '/recurring?date=2026-10-15');
    assert.equal(
      notificationHref(n({ relatedEntityId: 'rec-1' })),
      '/recurring',
    );
    assert.equal(notificationHref(n({ type: 'budget' })), '/planning/budgets');
    assert.equal(notificationHref(n({ type: 'debt_due' })), '/planning/debts');
    assert.equal(notificationHref(n({ type: 'summary' })), null);
  });

  it('unread means scheduled or sent', () => {
    assert.ok(isUnread('scheduled'));
    assert.ok(isUnread('sent'));
    assert.ok(!isUnread('read'));
    assert.ok(!isUnread('dismissed'));
  });

  it('says when, relative while recent', () => {
    // 15:30 UTC is 09:30 in Mexico City.
    assert.equal(
      notificationWhen(n().createdAt, today, { locale: 'es' }),
      'Hoy · 09:30',
    );
    assert.equal(
      notificationWhen('2026-10-10T15:30:00.000Z', today, { locale: 'es' }),
      'Hace 3 días',
    );
    assert.equal(
      notificationWhen('2026-09-01T15:30:00.000Z', today, { locale: 'en' }),
      'Sep 1',
    );
  });

  it('builds a page and marks items read locally', () => {
    const page = toNotificationPage(
      {
        totalCount: 3,
        edges: [{ node: n() }, { node: n({ id: 'n-2', status: 'read' }) }],
        pageInfo: { endCursor: 'abc', hasNextPage: true },
      },
      today,
      { locale: 'es' },
    );
    assert.deepEqual(
      page.items.map((i) => [i.id, i.unread]),
      [
        ['n-1', true],
        ['n-2', false],
      ],
    );
    assert.equal(page.hasNextPage, true);
    assert.deepEqual(
      markedRead(page.items, 'n-1').map((i) => i.unread),
      [false, false],
    );
    assert.deepEqual(
      markedRead(
        [
          { id: 'a', unread: true },
          { id: 'b', unread: true },
        ],
        'all',
      ),
      [
        { id: 'a', unread: false },
        { id: 'b', unread: false },
      ],
    );
  });

  it('reads the filter from the URL', () => {
    assert.equal(parseNotificationFilter('unread'), 'unread');
    assert.equal(parseNotificationFilter(['unread']), 'all');
    assert.equal(parseNotificationFilter(undefined), 'all');
  });
});
