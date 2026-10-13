import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  hasFilters,
  historyQuery,
  parseHistoryFilters,
  toApiFilters,
} from './filters';
import { categoryOptions } from './view';

describe('history filters', () => {
  it('reads valid filters from the URL and drops the rest', () => {
    assert.deepEqual(
      parseHistoryFilters({
        type: 'expense',
        account: 'acc-1',
        category: 'bad id!',
        from: '2026-10-01',
        to: '2026-02-30',
        q: '  oxxo ',
      }),
      {
        type: 'expense',
        accountId: 'acc-1',
        from: '2026-10-01',
        search: 'oxxo',
      },
    );
    assert.deepEqual(parseHistoryFilters({ type: 'all' }), {});
    assert.ok(!hasFilters({}));
  });

  it('round-trips through the URL', () => {
    const filters = {
      type: 'income' as const,
      from: '2026-10-01',
      search: 'nómina',
    };
    const query = historyQuery(filters);
    assert.equal(query, '?type=income&from=2026-10-01&q=n%C3%B3mina');
    assert.deepEqual(
      parseHistoryFilters(Object.fromEntries(new URLSearchParams(query))),
      filters,
    );
    assert.equal(historyQuery({}), '');
  });

  it('turns days into whole-day API dates', () => {
    assert.deepEqual(
      toApiFilters({ from: '2026-10-01', to: '2026-10-31', categoryId: 'c' }),
      {
        categoryId: 'c',
        startDate: '2026-10-01T00:00:00.000Z',
        endDate: '2026-10-31T23:59:59.999Z',
      },
    );
  });

  it('lists categories under their parent', () => {
    assert.deepEqual(
      categoryOptions([
        { id: 'f', name: 'Food & Dining', parentId: null },
        { id: 'r', name: 'Restaurants', parentId: 'f' },
        { id: 'p', name: 'Mascotas', parentId: null },
      ]).map((o) => o.label),
      ['Comida', 'Comida › Restaurantes', 'Mascotas'],
    );
  });
});
