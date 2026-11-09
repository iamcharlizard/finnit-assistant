import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { direction, toTransactionRow } from '@finnit/core/finance/transactions';
import type { ApiTransaction } from '@finnit/core/finance/types';
import { testLocalizer } from '@finnit/core/i18n/testing';
import { deleteBlock } from '@finnit/core/transaction-detail/view';
import {
  SET_ACCOUNT_BALANCE_MUTATION,
  balanceDifference,
  balanceFromTyped,
  setAccountBalance,
  type GqlRunner,
} from './api';

const es = testLocalizer('es');

const adjustment = (amount: number): ApiTransaction => ({
  id: 't1',
  type: 'adjustment',
  amount,
  currency: 'MXN',
  txnDate: '2026-11-03T18:00:00.000Z',
  description: 'Balance update',
  merchantName: null,
  displayName: 'Balance update',
  isPrivate: false,
  isPending: false,
  source: 'manual',
  accountId: 'a1',
  account: { id: 'a1', name: 'Nómina', type: 'debit' },
  category: null,
});

describe('balance update', () => {
  it('stores what is owed on a card as a negative balance', () => {
    assert.equal(balanceFromTyped(878.29, false), 878.29);
    assert.equal(balanceFromTyped(1500, true), -1500);
  });

  it('is the difference from the recorded balance, in cents', () => {
    assert.equal(balanceDifference(189_510.29, 878.29), -188_632);
    assert.equal(balanceDifference(-1500, -1200.1), 299.9);
    assert.equal(balanceDifference(10.1, 10.1), 0);
  });

  it('sends the new balance and a trimmed note', async () => {
    const calls: [string, unknown][] = [];
    const run = (async (query: string, variables: unknown) => {
      calls.push([query, variables]);
      return {};
    }) as GqlRunner;
    await setAccountBalance('a1', { balance: 878.29, description: '  ' }, run);
    await setAccountBalance('a1', { balance: 5, description: ' Corte ' }, run);
    assert.deepEqual(calls, [
      [
        SET_ACCOUNT_BALANCE_MUTATION,
        { input: { accountId: 'a1', balance: 878.29 } },
      ],
      [
        SET_ACCOUNT_BALANCE_MUTATION,
        { input: { accountId: 'a1', balance: 5, description: 'Corte' } },
      ],
    ]);
  });

  it('shows a negative adjustment as money out', () => {
    assert.equal(direction(adjustment(-188_632)), 'out');
    assert.equal(direction(adjustment(500)), 'unknown');
    const row = toTransactionRow(adjustment(-250), new Map(), es);
    assert.equal(row.variant, 'expense');
    assert.match(row.amount, /^-\$/);
  });

  it("can't delete an adjustment (the balance is updated instead)", () => {
    assert.equal(deleteBlock({ type: 'adjustment' }), 'adjustment');
    assert.equal(deleteBlock({ type: 'expense' }), null);
  });
});
