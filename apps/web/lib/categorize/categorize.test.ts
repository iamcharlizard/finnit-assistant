import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { indexCategories } from '@/lib/finance/categories';
import { GraphqlRequestError } from '@/lib/graphql/client';
import { testLocalizer } from '@/lib/i18n/testing';
import {
  CATEGORIZE_MUTATION,
  SUGGEST_MUTATION,
  categorize,
  categorizeErrorMessage,
  renameTransaction,
  reviewSuggestions,
  suggestCategories,
} from './api';
import {
  categorizeHref,
  categorizeQuery,
  pageVariables,
  parseCategorizeFilters,
  periodLinks,
  toApiFilters,
  type CategorizeFilters,
} from './filters';
import { renameFormOf, renameInput, validateRename } from './rename';
import {
  categorizeBatches,
  isAllSelected,
  isSomeSelected,
  pruneSelection,
  reviewTargets,
  selectedIds,
  suggestionOutcome,
  suggestionTargets,
  toggleAll,
  toggleSelection,
} from './selection';
import type { CategorizeTransaction } from './types';
import { appendPage, mergeTransactions, toCategorizeRow } from './view';

const TODAY = '2026-10-13';
const es = testLocalizer('es');

const tx = (
  overrides: Partial<CategorizeTransaction> = {},
): CategorizeTransaction => ({
  id: 't1',
  type: 'expense',
  amount: 120,
  currency: 'MXN',
  txnDate: '2026-10-12T18:00:00.000Z',
  description: 'CLIP MX*TACOS 2231',
  merchantName: null,
  displayName: 'CLIP MX*TACOS 2231',
  isPrivate: false,
  isPending: false,
  source: 'imported',
  accountId: 'a1',
  account: { id: 'a1', name: 'BBVA', type: 'debit' },
  category: null,
  categorySource: null,
  suggestedCategory: null,
  originalDescription: 'CLIP MX*TACOS 2231',
  ...overrides,
});

const CATEGORIES = indexCategories([
  { id: 'food', name: 'Comida', parentId: null },
  { id: 'tacos', name: 'Restaurantes', parentId: 'food' },
]);

const row = (
  id: string,
  extra: Partial<{
    selectable: boolean;
    categoryId: string | null;
    suggestion: { categoryId: string } | null;
  }> = {},
) => ({
  id,
  selectable: true,
  categoryId: null,
  suggestion: null,
  ...extra,
});

describe('categorize filters', () => {
  it('reads the URL with defaults', () => {
    assert.deepEqual(parseCategorizeFilters({}, TODAY), {
      show: 'uncategorized',
      period: { year: 2026, month: 10 },
    });
    assert.deepEqual(
      parseCategorizeFilters(
        { show: 'suggested', account: 'acc-1', month: '2026-08' },
        TODAY,
      ),
      {
        show: 'suggested',
        accountId: 'acc-1',
        period: { year: 2026, month: 8 },
      },
    );
    assert.equal(parseCategorizeFilters({ month: 'all' }, TODAY).period, 'all');
    const junk = parseCategorizeFilters(
      { show: 'nope', account: 'x y', month: '2026-13' },
      TODAY,
    );
    assert.equal(junk.show, 'uncategorized');
    assert.equal(junk.accountId, undefined);
    assert.deepEqual(junk.period, { year: 2026, month: 10 });
  });

  it('round-trips through the URL, leaving defaults out', () => {
    const base: CategorizeFilters = {
      show: 'uncategorized',
      period: { year: 2026, month: 10 },
    };
    assert.equal(categorizeQuery(base, TODAY), '');
    const filters: CategorizeFilters = {
      show: 'all',
      accountId: 'a1',
      period: { year: 2026, month: 9 },
    };
    const query = categorizeQuery(filters, TODAY);
    assert.equal(query, '?show=all&account=a1&month=2026-09');
    assert.deepEqual(
      parseCategorizeFilters(
        Object.fromEntries(new URLSearchParams(query)),
        TODAY,
      ),
      filters,
    );
    assert.equal(
      categorizeHref({ ...base, period: 'all' }, TODAY),
      '/transactions/categorize?month=all',
    );
  });

  it('maps filters to the API, by month or all time', () => {
    assert.deepEqual(
      toApiFilters({
        show: 'uncategorized',
        accountId: 'a1',
        period: { year: 2026, month: 2 },
      }),
      {
        accountId: 'a1',
        startDate: '2026-02-01T00:00:00.000Z',
        endDate: '2026-02-28T23:59:59.999Z',
        uncategorized: true,
      },
    );
    assert.deepEqual(toApiFilters({ show: 'suggested', period: 'all' }), {
      hasSuggestion: true,
    });
    assert.deepEqual(toApiFilters({ show: 'all', period: 'all' }), {});
  });

  it('pages 30 at a time and reloads what is on screen, up to 100', () => {
    const f: CategorizeFilters = { show: 'all', period: 'all' };
    assert.deepEqual(pageVariables(f), { first: 30, after: null, filters: {} });
    assert.equal(pageVariables(f, { after: 'c1' }).after, 'c1');
    assert.equal(pageVariables(f, { loaded: 60 }).first, 60);
    assert.equal(pageVariables(f, { loaded: 250 }).first, 100);
    assert.equal(pageVariables(f, { loaded: 3 }).first, 30);
  });

  it('links months, never into the future', () => {
    const links = periodLinks(
      { show: 'uncategorized', period: { year: 2026, month: 10 } },
      TODAY,
    );
    assert.equal(links?.prevHref, '/transactions/categorize?month=2026-09');
    assert.equal(links?.nextHref, null);
    const past = periodLinks(
      { show: 'all', period: { year: 2026, month: 9 } },
      TODAY,
    );
    assert.equal(past?.nextHref, '/transactions/categorize?show=all');
    assert.equal(periodLinks({ show: 'all', period: 'all' }, TODAY), null);
  });
});

describe('categorize rows', () => {
  it('shows the suggestion and keeps the original text', () => {
    const r = toCategorizeRow(
      tx({
        suggestedCategory: {
          id: 'tacos',
          name: 'Restaurantes',
          parentId: 'food',
        },
      }),
      CATEGORIES,
      es,
    );
    assert.equal(r.selectable, true);
    assert.deepEqual(r.suggestion, {
      categoryId: 'tacos',
      label: 'Restaurantes',
    });
    assert.equal(r.original, 'CLIP MX*TACOS 2231');
    assert.equal(r.category, 'Sin categoría');
  });

  it('never shows the original of a private one', () => {
    const r = toCategorizeRow(
      tx({
        displayName: 'Regalo',
        isPrivate: true,
        aliasId: 'al1',
        originalDescription: null,
        description: null,
      }),
      CATEGORIES,
      es,
    );
    assert.equal(r.title, 'Regalo');
    assert.equal(r.isPrivate, true);
    assert.equal(r.original, null);
  });

  it('leaves transfers and adjustments out of the selection', () => {
    assert.equal(
      toCategorizeRow(tx({ type: 'transfer' }), CATEGORIES, es).selectable,
      false,
    );
    assert.equal(
      toCategorizeRow(tx({ type: 'adjustment' }), CATEGORIES, es).selectable,
      false,
    );
  });

  it('merges updates in place and appends pages without repeats', () => {
    const list = [tx({ id: 'a' }), tx({ id: 'b' })];
    const merged = mergeTransactions(list, [
      tx({ id: 'b', category: { id: 'food', name: 'Comida', parentId: null } }),
      tx({ id: 'zzz' }),
    ]);
    assert.deepEqual(
      merged.map((t) => [t.id, t.category?.id ?? null]),
      [
        ['a', null],
        ['b', 'food'],
      ],
    );
    assert.deepEqual(
      appendPage(list, [tx({ id: 'b' }), tx({ id: 'c' })]).map((t) => t.id),
      ['a', 'b', 'c'],
    );
  });
});

describe('selection', () => {
  const rows = [row('a'), row('b'), row('t', { selectable: false }), row('c')];

  it('toggles one and all (selectable rows only)', () => {
    let sel = toggleSelection(new Set(), 'a', true);
    assert.deepEqual([...sel], ['a']);
    assert.ok(isSomeSelected(rows, sel));
    assert.ok(!isAllSelected(rows, sel));
    sel = toggleAll(rows, sel);
    assert.deepEqual([...sel].sort(), ['a', 'b', 'c']);
    assert.ok(isAllSelected(rows, sel));
    sel = toggleAll(rows, sel);
    assert.equal(sel.size, 0);
    assert.ok(!isAllSelected([row('t', { selectable: false })], new Set()));
    assert.deepEqual([...toggleSelection(new Set(['a']), 'a', false)], []);
  });

  it('drops rows that left the screen and keeps screen order', () => {
    const pruned = pruneSelection(new Set(['c', 'gone', 'a']), rows);
    assert.deepEqual(selectedIds(rows, pruned), ['a', 'c']);
  });

  it('suggests for the selection, or else for uncategorized rows without one', () => {
    assert.deepEqual(suggestionTargets(rows, new Set(['c', 'a'])), {
      ids: ['a', 'c'],
      truncated: false,
    });
    const mixed = [
      row('a'),
      row('b', { categoryId: 'food' }),
      row('c', { suggestion: { categoryId: 'food' } }),
      row('t', { selectable: false }),
      row('d'),
    ];
    assert.deepEqual(suggestionTargets(mixed, new Set()).ids, ['a', 'd']);
    const many = Array.from({ length: 130 }, (_, i) => row(`r${i}`));
    const capped = suggestionTargets(many, new Set());
    assert.equal(capped.ids.length, 100);
    assert.equal(capped.truncated, true);
  });

  it('reviews the selected suggestions, or all of them', () => {
    const list = [
      row('a', { suggestion: { categoryId: 'x' } }),
      row('b'),
      row('c', { suggestion: { categoryId: 'y' } }),
    ];
    assert.deepEqual(reviewTargets(list, new Set()), ['a', 'c']);
    assert.deepEqual(reviewTargets(list, new Set(['b', 'c'])), ['c']);
  });

  it('splits bulk moves into batches of 500', () => {
    const ids = Array.from({ length: 1201 }, (_, i) => `id${i}`);
    const batches = categorizeBatches([...ids, 'id0'], 'food', true);
    assert.deepEqual(
      batches.map((b) => b.ids.length),
      [500, 500, 201],
    );
    assert.deepEqual(
      {
        categoryId: batches[0]!.categoryId,
        createRule: batches[0]!.createRule,
      },
      { categoryId: 'food', createRule: true },
    );
    assert.deepEqual(categorizeBatches([], 'food', false), []);
  });

  it('tells when the AI gave no suggestion', () => {
    assert.deepEqual(suggestionOutcome(['a', 'b'], []), {
      suggested: 0,
      unavailable: true,
    });
    assert.deepEqual(
      suggestionOutcome(
        ['a', 'b'],
        [
          { id: 'a', suggestedCategory: { id: 'food' } },
          { id: 'b', suggestedCategory: null },
          { id: 'other', suggestedCategory: { id: 'x' } },
        ],
      ),
      { suggested: 1, unavailable: false },
    );
    assert.deepEqual(suggestionOutcome([], []), {
      suggested: 0,
      unavailable: false,
    });
  });
});

describe('rename (one-off alias)', () => {
  it('starts empty unless the movement already has its own name', () => {
    assert.deepEqual(
      renameFormOf({
        displayName: 'OXXO',
        hasOwnAlias: false,
        isPrivate: false,
      }),
      { displayName: '', isPrivate: false },
    );
    assert.deepEqual(
      renameFormOf({
        displayName: 'Regalo',
        hasOwnAlias: true,
        isPrivate: true,
      }),
      { displayName: 'Regalo', isPrivate: true },
    );
  });

  it('validates and builds the input', () => {
    assert.equal(
      validateRename({ displayName: '  ', isPrivate: false }),
      'required',
    );
    assert.equal(
      validateRename({ displayName: 'x'.repeat(81), isPrivate: false }),
      'tooLong',
    );
    assert.equal(
      validateRename({ displayName: 'Cena', isPrivate: true }),
      null,
    );
    assert.deepEqual(renameInput({ displayName: ' Cena ', isPrivate: true }), {
      displayName: 'Cena',
      isPrivate: true,
    });
    assert.deepEqual(renameInput('remove'), {
      displayName: null,
      isPrivate: false,
    });
  });
});

describe('categorize api', () => {
  it('sends one mutation per batch and adds up the changes', async () => {
    const calls: { query: string; variables?: Record<string, unknown> }[] = [];
    const run = async <T>(
      query: string,
      variables?: Record<string, unknown>,
    ) => {
      calls.push({ query, variables });
      return {
        categorizeTransactions: (variables!.ids as string[]).length,
      } as T;
    };
    const ids = Array.from({ length: 501 }, (_, i) => `t${i}`);
    assert.equal(await categorize(ids, 'food', false, run), 501);
    assert.equal(calls.length, 2);
    assert.equal(calls[0]!.query, CATEGORIZE_MUTATION);
    assert.deepEqual(
      { ...calls[1]!.variables },
      { ids: ['t500'], categoryId: 'food', createRule: false },
    );
  });

  it('skips empty requests and passes the ids through', async () => {
    let called = 0;
    const run = async <T>(
      query: string,
      variables?: Record<string, unknown>,
    ) => {
      called++;
      if (query === SUGGEST_MUTATION) {
        return {
          suggestTransactionCategories: (variables!.ids as string[]).map((id) =>
            tx({ id }),
          ),
        } as T;
      }
      if (query.includes('setTransactionAlias')) {
        return { setTransactionAlias: tx({ ...variables }) } as T;
      }
      return {
        acceptCategorySuggestions: 2,
        rejectCategorySuggestions: 1,
      } as T;
    };
    assert.deepEqual(await suggestCategories([], run), []);
    assert.equal(await reviewSuggestions('accept', [], run), 0);
    assert.equal(called, 0);
    assert.equal((await suggestCategories(['a'], run))[0]!.id, 'a');
    assert.equal(await reviewSuggestions('accept', ['a', 'b'], run), 2);
    assert.equal(await reviewSuggestions('reject', ['a'], run), 1);
    assert.equal(
      (
        await renameTransaction(
          't9',
          { displayName: 'X', isPrivate: false },
          run,
        )
      ).id,
      't9',
    );
  });

  it('translates known API errors', () => {
    const t = testLocalizer('es').t;
    assert.equal(
      categorizeErrorMessage(
        new GraphqlRequestError(
          'You can categorize at most 500 transactions',
          'BAD_REQUEST',
          true,
        ),
        t,
      ),
      'Son demasiados movimientos a la vez.',
    );
    assert.equal(
      categorizeErrorMessage(
        new GraphqlRequestError('Category not found', 'NOT_FOUND', true),
        t,
      ),
      'Esa categoría ya no existe.',
    );
  });
});
