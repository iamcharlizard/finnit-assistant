import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { waitlistRows } from './waitlist';

describe('waitlistRows', () => {
  it('formats the sign-up time in Mexico City and fills blanks', () => {
    const rows = waitlistRows({
      waitlistEntries: {
        totalCount: 1,
        edges: [
          {
            node: {
              id: 'w1',
              email: 'ada@example.com',
              locale: null,
              source: 'ig',
              createdAt: '2026-11-06T02:15:00.000Z',
            },
          },
        ],
      },
    });
    assert.deepEqual(rows, [
      {
        id: 'w1',
        email: 'ada@example.com',
        locale: '—',
        source: 'ig',
        joinedAt: '2026-11-05 20:15',
      },
    ]);
  });
});
