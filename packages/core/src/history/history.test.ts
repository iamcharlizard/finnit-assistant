import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  hasFilters,
  historyQuery,
  monthLinks,
  activeFilterCount,
  categoryCheck,
  isSelected,
  selectCategory,
  selectValues,
  parseHistoryFilters,
  parseShown,
  shownParam,
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
  selectionLabel,
  toHistoryRow,
  topCategoryChart,
  topCategoryRows,
} from './view';

describe('history filters', () => {
  it('filters by state (?status=) and sends it to the API', () => {
    const today = '2026-11-05' as const;
    const filters = parseHistoryFilters({ status: 'cancelled,pending' }, today);
    assert.deepEqual(filters.statuses, ['cancelled', 'pending']);
    assert.equal(historyQuery(filters, today), '?status=cancelled%2Cpending');
    assert.deepEqual(toApiFilters(filters).statuses, ['cancelled', 'pending']);
    assert.equal(activeFilterCount(filters), 1);
    // Every state checked is no filter; `-` is none; unknown ones are ignored.
    assert.equal(
      parseHistoryFilters({ status: 'pending,completed,cancelled' }, today)
        .statuses,
      undefined,
    );
    assert.deepEqual(parseHistoryFilters({ status: '-' }, today).statuses, []);
    assert.equal(
      parseHistoryFilters({ status: 'x' }, today).statuses,
      undefined,
    );
  });

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
          account: 'acc-1,acc-2,acc-1',
          category: 'bad id!',
          from: '2026-10-01',
          to: '2026-02-30',
          q: '  oxxo ',
        },
        today,
      ),
      {
        types: ['expense'],
        accountIds: ['acc-1', 'acc-2'],
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
      types: ['income' as const],
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
    assert.deepEqual(toApiFilters({ categoryIds: ['c'], period: november }), {
      types: ['expense'],
      categoryIds: ['c'],
      includeUncategorized: false,
      categorizable: true,
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
        { from: '2026-11-01', accountIds: ['a'], period: 'all' },
        november,
      ),
      { accountIds: ['a'], period: november },
    );
  });

  it('chooses several accounts, categories and types, "Sin categoría" included', () => {
    const filters = parseHistoryFilters(
      { account: ['a1', 'a2'], category: 'c1,none', type: 'expense,income' },
      today,
    );
    assert.deepEqual(filters.accountIds, ['a1', 'a2']);
    assert.deepEqual(filters.types, ['expense', 'income']);
    assert.equal(
      historyQuery(filters, today),
      '?type=expense%2Cincome&account=a1%2Ca2&category=c1%2Cnone',
    );
    // Categories narrow to expenses: no income, transfers or adjustments.
    assert.deepEqual(toApiFilters(filters), {
      types: ['expense'],
      accountIds: ['a1', 'a2'],
      categoryIds: ['c1'],
      includeUncategorized: true,
      categorizable: true,
      startDate: '2026-11-01T00:00:00.000Z',
      endDate: '2026-11-30T23:59:59.999Z',
    });
    // One per group that narrows the list.
    assert.equal(activeFilterCount(filters), 3);
    assert.equal(
      activeFilterCount({ from: '2026-11-01', period: november }),
      1,
    );
    assert.equal(activeFilterCount({ period: 'all' }), 1);
    assert.equal(activeFilterCount({ period: november }), 0);
    // Every type is no filter; an old `type=all` too.
    assert.equal(
      parseHistoryFilters({ type: 'income,expense,transfer' }, today).types,
      undefined,
    );
  });

  it('keeps an empty selection, which shows nothing', () => {
    const filters = parseHistoryFilters(
      { account: '-', category: '-', type: '-' },
      today,
    );
    assert.deepEqual(filters.accountIds, []);
    assert.deepEqual(filters.categoryIds, []);
    assert.deepEqual(filters.types, []);
    assert.equal(historyQuery(filters, today), '?type=-&account=-&category=-');
    assert.deepEqual(toApiFilters({ ...filters, period: 'all' }), {
      types: [],
      accountIds: [],
      categoryIds: [],
      includeUncategorized: false,
      categorizable: true,
    });
  });

  it('"Sin categoría" alone shows expenses without one, never transfers or income', () => {
    const filters = parseHistoryFilters({ category: 'none' }, today);
    assert.deepEqual(toApiFilters({ ...filters, period: 'all' }), {
      types: ['expense'],
      categoryIds: [],
      includeUncategorized: true,
      categorizable: true,
    });
    // Only income chosen: categories leave nothing.
    assert.deepEqual(
      toApiFilters({ ...filters, types: ['income'], period: 'all' }).types,
      [],
    );
  });

  it('keeps how many rows were loaded in the URL, within the API page', () => {
    assert.equal(parseShown({}), 30);
    assert.equal(parseShown({ n: '90' }), 90);
    assert.equal(parseShown({ n: '5' }), 30);
    assert.equal(parseShown({ n: '9999' }), 200);
    assert.equal(parseShown({ n: 'x' }), 30);
    assert.equal(shownParam(30), null);
    assert.equal(shownParam(60), '60');
    assert.equal(shownParam(260), '200');
  });

  it('"Por clasificar" lists what can take a category and has none', () => {
    const filters = parseHistoryFilters({ review: '1', category: 'c1' }, today);
    assert.equal(filters.review, true);
    assert.equal(historyQuery(filters, today), '?category=c1&review=1');
    assert.ok(hasFilters({ review: true, period: november }));
    assert.deepEqual(toApiFilters({ ...filters, period: 'all' }), {
      uncategorized: true,
      categorizable: true,
    });
    assert.equal(parseHistoryFilters({ review: '0' }, today).review, undefined);
  });

  it('checks everything by default and gives "everything" back', () => {
    const all = ['a', 'b', 'c'];
    assert.ok(isSelected(undefined, 'a'));
    assert.deepEqual(selectValues(undefined, ['b'], false, all), ['a', 'c']);
    assert.equal(selectValues(['a', 'c'], ['b'], true, all), undefined);
    assert.deepEqual(selectValues(undefined, all, false, all), []);
  });

  it('labels a narrowed selection', () => {
    const { t } = testLocalizer('es');
    const options = [
      { value: 'a', label: 'Nu' },
      { value: 'b', label: 'Revolut' },
      { value: 'c', label: 'BBVA' },
    ];
    assert.equal(
      selectionLabel('Cuentas', ['a', 'b'], options, t),
      'Cuentas: Nu, Revolut',
    );
    assert.equal(selectionLabel('Cuentas', [], options, t), 'Cuentas: 0 de 3');
  });

  it('checks a parent category with its subcategories', () => {
    const options = [
      { value: 'none' },
      { value: 'food' },
      { value: 'coffee', parentId: 'food' },
      { value: 'groceries', parentId: 'food' },
      { value: 'home' },
    ];
    const food = options[1]!;
    const coffee = options[2]!;
    // Unchecking a subcategory unchecks its parent (mixed).
    const noCoffee = selectCategory(undefined, coffee, false, options);
    assert.deepEqual(noCoffee, ['none', 'groceries', 'home']);
    assert.equal(categoryCheck(noCoffee, food, options), 'indeterminate');
    // Checking it again completes the family.
    assert.equal(selectCategory(noCoffee, coffee, true, options), undefined);
    // The parent takes its whole family.
    assert.deepEqual(selectCategory(undefined, food, false, options), [
      'none',
      'home',
    ]);
    assert.deepEqual(selectCategory([], food, true, options), [
      'food',
      'coffee',
      'groceries',
    ]);
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

  it('lists "Sin categoría" and the expense categories under their parent', () => {
    assert.deepEqual(
      categoryOptions(
        [
          { id: 'f', name: 'Comida', parentId: null, kind: 'expense' },
          { id: 'r', name: 'Restaurantes', parentId: 'f', kind: 'expense' },
          { id: 's', name: 'Sueldo', parentId: null, kind: 'income' },
          { id: 'p', name: 'Mascotas', parentId: null },
        ],
        testLocalizer('es').t,
      ).map((o) => `${o.value}:${o.label}`),
      [
        'none:Sin categoría',
        'f:Comida',
        'r:Comida › Restaurantes',
        'p:Mascotas',
      ],
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

  it('marks a cancelled movement and leaves it out of the day net', () => {
    const cancelled = row({
      type: 'expense',
      amount: 50,
      cancelledAt: '2026-10-20T10:00:00.000Z',
    });
    assert.equal(cancelled.status, 'cancelled');
    assert.equal(cancelled.net, 0);
  });

  it('leaves categories out of the totals out of the day net', () => {
    const category = { id: 'c', name: 'Sin seguimiento', parentId: null };
    assert.notEqual(row({ type: 'expense', amount: 50, category }).net, 0);
    assert.equal(
      row({
        type: 'expense',
        amount: 50,
        category: { ...category, excludeFromTotals: true },
      }).net,
      0,
    );
  });

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
    assert.equal(group.title, 'Transferencia');
    assert.equal(group.cardPayment, false);
  });

  it('calls a transfer into a credit card its payment', () => {
    const [group] = groupTransfers(
      [
        row({
          id: 'out',
          type: 'transfer',
          transferId: 'tr-3',
          transferDirection: 'out',
        }),
        row({
          id: 'in',
          type: 'transfer',
          transferId: 'tr-3',
          transferDirection: 'in',
          accountId: 'c1',
          account: { id: 'c1', name: 'Nu', type: 'credit', metadata: null },
        }),
      ],
      es,
    );
    assert.equal(group?.kind, 'transfer');
    if (group?.kind !== 'transfer') return;
    assert.equal(group.title, 'Pago de tarjeta');
    assert.equal(group.cardPayment, true);
  });

  it("shows a row's pending AI suggestion", () => {
    const shown = toHistoryRow(
      {
        ...tx({}),
        suggestedCategory: { id: 'food', name: 'Comida', parentId: null },
      },
      indexCategories([]),
      es,
    );
    assert.deepEqual(shown.suggestion, { categoryId: 'food', label: 'Comida' });
    assert.equal(row({}).suggestion, null);
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
    // Pastel colors by place, so the five always differ.
    assert.deepEqual(
      chart.slices.slice(0, 5).map((s) => s.dotColor),
      [1, 2, 3, 4, 5].map((n) => `var(--chart-pastel-${n})`),
    );
    const rows = topCategoryRows(chart);
    assert.equal(rows.length, 5);
    assert.equal(rows[0]!.amount, '$300.00');
    assert.equal(rows[0]!.dotColor, 'var(--chart-pastel-1)');
  });
});
