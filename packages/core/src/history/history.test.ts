import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  hasFilters,
  historyQuery,
  monthLinks,
  moreFiltersCount,
  parseHistoryFilters,
  toApiFilters,
  withPeriod,
} from './filters';
import { testLocalizer } from '../i18n/testing';
import { indexCategories } from '../finance/categories';
import type {
  ApiCategory,
  ApiMonthlyReport,
  ApiTransaction,
} from '../finance/types';
import {
  accountOptions,
  categoryOptions,
  dayNet,
  groupTransfers,
  toHistoryRow,
  topCategoryChart,
  topCategoryRows,
} from './view';

describe('history filters', () => {
  it('filters by an automatic name (?alias=) and sends it to the API', () => {
    const today = '2026-11-05' as const;
    const filters = parseHistoryFilters({ alias: 'alias-1' }, today);
    assert.equal(filters.aliasId, 'alias-1');
    assert.equal(historyQuery(filters, today), '?alias=alias-1');
    assert.equal(toApiFilters(filters).aliasId, 'alias-1');
    assert.equal(hasFilters(filters), true);
    assert.equal(
      parseHistoryFilters({ alias: 'bad id!' }, today).aliasId,
      undefined,
    );
  });

  const today = '2026-11-05';
  const november = { year: 2026, month: 11 };

  it('reads valid filters from the URL and drops the rest', () => {
    assert.deepEqual(
      parseHistoryFilters(
        {
          type: 'expense',
          account: 'acc-1',
          category: 'bad id!',
          from: '2026-10-01',
          to: '2026-02-30',
          q: '  oxxo ',
        },
        today,
      ),
      {
        type: 'expense',
        accountId: 'acc-1',
        from: '2026-10-01',
        search: 'oxxo',
        period: november,
      },
    );
    assert.deepEqual(parseHistoryFilters({ type: 'all' }, today), {
      period: november,
    });
    assert.deepEqual(parseHistoryFilters({ month: '2026-09' }, today).period, {
      year: 2026,
      month: 9,
    });
    assert.equal(parseHistoryFilters({ month: 'all' }, today).period, 'all');
    assert.ok(!hasFilters({ period: november }));
  });

  it('round-trips through the URL, leaving this month out', () => {
    const filters = {
      type: 'income' as const,
      search: 'nómina',
      period: { year: 2026, month: 9 },
    };
    const query = historyQuery(filters, today);
    assert.equal(query, '?type=income&q=n%C3%B3mina&month=2026-09');
    assert.deepEqual(
      parseHistoryFilters(
        Object.fromEntries(new URLSearchParams(query)),
        today,
      ),
      filters,
    );
    assert.equal(historyQuery({ period: november }, today), '');
    assert.equal(historyQuery({ period: 'all' }, today), '?month=all');
    // A range replaces the month.
    assert.equal(
      historyQuery(
        { from: '2026-11-03', to: '2026-11-03', period: november },
        today,
      ),
      '?from=2026-11-03&to=2026-11-03',
    );
  });

  it('asks the API for the month, the range or everything', () => {
    assert.deepEqual(toApiFilters({ categoryId: 'c', period: november }), {
      categoryId: 'c',
      startDate: '2026-11-01T00:00:00.000Z',
      endDate: '2026-11-30T23:59:59.999Z',
    });
    assert.deepEqual(
      toApiFilters({ from: '2026-10-01', to: '2026-10-31', period: november }),
      {
        startDate: '2026-10-01T00:00:00.000Z',
        endDate: '2026-10-31T23:59:59.999Z',
      },
    );
    assert.deepEqual(toApiFilters({ period: 'all' }), {});
  });

  it('moves between months, never into the future', () => {
    assert.deepEqual(monthLinks({ period: november }, today), {
      prev: { year: 2026, month: 10 },
      next: null,
    });
    assert.deepEqual(
      monthLinks({ period: { year: 2026, month: 9 } }, today)?.next,
      { year: 2026, month: 10 },
    );
    assert.equal(monthLinks({ period: 'all' }, today), null);
    assert.deepEqual(
      withPeriod(
        { from: '2026-11-01', accountId: 'a', period: 'all' },
        november,
      ),
      { accountId: 'a', period: november },
    );
    assert.equal(
      moreFiltersCount({ accountId: 'a', from: '2026-11-01', period: 'all' }),
      2,
    );
  });

  it("adds up a day's income and spending in one currency", () => {
    assert.deepEqual(
      dayNet([
        { net: 1200, currency: 'MXN' },
        { net: -80.5, currency: 'MXN' },
        { net: 0, currency: 'MXN' },
      ]),
      { amount: 1119.5, currency: 'MXN' },
    );
    assert.equal(
      dayNet([
        { net: 10, currency: 'MXN' },
        { net: 10, currency: 'USD' },
      ]),
      null,
    );
  });

  it('lists categories under their parent', () => {
    assert.deepEqual(
      categoryOptions(
        [
          { id: 'f', name: 'Comida', parentId: null },
          { id: 'r', name: 'Restaurantes', parentId: 'f' },
          { id: 'p', name: 'Mascotas', parentId: null },
        ],
        testLocalizer('es').t,
      ).map((o) => o.label),
      ['Comida', 'Comida › Restaurantes', 'Mascotas'],
    );
  });

  it('labels accounts with their type', () => {
    const account = {
      id: 'a',
      name: 'Oro',
      type: 'credit' as const,
      currency: 'MXN',
      balanceCurrent: 0,
      archived: false,
      metadata: null,
      creditCardTerms: null,
    };
    assert.equal(
      accountOptions([account], testLocalizer('es').t)[0]?.label,
      'Oro · Crédito',
    );
    assert.equal(
      accountOptions([account], testLocalizer('en').t)[0]?.label,
      'Oro · Credit',
    );
  });
});

describe('history: transfers and top categories', () => {
  const es = testLocalizer('es');
  const tx = (over: Partial<ApiTransaction>): ApiTransaction => ({
    id: 't',
    type: 'expense',
    amount: 100,
    currency: 'MXN',
    txnDate: '2026-11-05T00:00:00.000Z',
    description: 'Cena',
    merchantName: null,
    isPending: false,
    source: 'manual',
    transferDirection: null,
    accountId: 'a1',
    account: { id: 'a1', name: 'BBVA Débito', type: 'debit', metadata: null },
    category: null,
    displayName: 'Cena',
    isPrivate: false,
    aliasId: null,
    hasOwnAlias: false,
    ...over,
  });
  const row = (over: Partial<ApiTransaction>) =>
    toHistoryRow(tx(over), indexCategories([]), es);

  it("joins a transfer's two sides where the first one was", () => {
    const items = groupTransfers(
      [
        row({ id: 'e1' }),
        row({
          id: 'in',
          type: 'transfer',
          amount: 1000,
          transferId: 'tr-1',
          transferDirection: 'in',
          accountId: 'a2',
          account: { id: 'a2', name: 'Nu', type: 'debit', metadata: null },
        }),
        row({ id: 'e2' }),
        row({
          id: 'out',
          type: 'transfer',
          amount: 1000,
          transferId: 'tr-1',
          transferDirection: 'out',
        }),
      ],
      es,
    );
    assert.deepEqual(
      items.map((i) => (i.kind === 'row' ? i.row.id : i.key)),
      ['e1', 'transfer:tr-1', 'e2'],
    );
    const group = items[1]!;
    assert.equal(group.kind, 'transfer');
    if (group.kind !== 'transfer') return;
    assert.equal(group.route, 'BBVA Débito → Nu');
    assert.equal(group.amount, '$1,000.00');
    assert.equal(group.outLabel, 'Sale de BBVA Débito');
    assert.equal(group.inLabel, 'Entra a Nu');
    assert.equal(group.out.id, 'out');
  });

  it('keeps a side alone when its pair is not in the list', () => {
    const items = groupTransfers(
      [
        row({
          id: 'out',
          type: 'transfer',
          transferId: 'tr-2',
          transferDirection: 'out',
        }),
      ],
      es,
    );
    assert.deepEqual(items, [
      { kind: 'row', row: items[0]!.kind === 'row' ? items[0]!.row : null },
    ]);
  });

  it('charts the top five categories and the rest together', () => {
    const report = {
      totalExpenses: 1000,
      categoryBreakdown: [
        ['c1', 'Comida', 300],
        ['c2', 'Transporte', 200],
        ['c3', 'Servicios', 150],
        ['c4', 'Compras', 120],
        ['c5', 'Salud', 100],
        ['c6', 'Mascotas', 80],
        ['c7', 'Regalos', 50],
      ].map(([categoryId, categoryName, amount]) => ({
        categoryId,
        categoryName,
        amount,
      })),
    } as unknown as ApiMonthlyReport;
    const categories = report.categoryBreakdown.map((c) => ({
      id: c.categoryId,
      name: c.categoryName,
      parentId: null,
    })) as ApiCategory[];
    const chart = topCategoryChart(report, categories, es);
    assert.equal(chart.slices.length, 6);
    assert.deepEqual(chart.slices[5], {
      id: 'others',
      label: 'Otras categorías',
      percentage: '13%',
      dotColor: 'var(--outline)',
      value: 130,
      amount: '$130.00',
      percent: 13,
      others: true,
    });
    assert.equal(chart.total, '$1,000.00');
    assert.equal(
      Math.round(chart.slices.reduce((sum, s) => sum + s.percent, 0)),
      100,
    );
    const rows = topCategoryRows(report, categories, es);
    assert.equal(rows.length, 5);
    assert.equal(rows[0]!.amount, '$300.00');
  });
});
