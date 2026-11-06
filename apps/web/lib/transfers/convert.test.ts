import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import type { ApiTransaction } from '@/lib/finance/types';
import type { EntryAccount } from '@/lib/new-entry/graphql';
import {
  canConvertToTransfer,
  candidatesIn,
  convertDirection,
  convertInput,
  convertTargets,
  initialConvertChoice,
} from './convert';

const account = (
  id: string,
  over: Partial<EntryAccount> = {},
): EntryAccount => ({
  id,
  name: id,
  type: 'debit',
  currency: 'MXN',
  balanceCurrent: 0,
  archived: false,
  metadata: null,
  ...over,
});

const candidate = (id: string, accountId: string) =>
  ({ id, accountId }) as ApiTransaction;

const source = {
  id: 'tx',
  type: 'expense',
  accountId: 'debit',
  currency: 'MXN',
  amount: 25_686,
};

describe('convert to transfer', () => {
  it('only converts expenses and income', () => {
    assert.equal(canConvertToTransfer({ type: 'expense' }), true);
    assert.equal(canConvertToTransfer({ type: 'income' }), true);
    assert.equal(canConvertToTransfer({ type: 'transfer' }), false);
    assert.equal(canConvertToTransfer({ type: 'adjustment' }), false);
    assert.equal(convertDirection({ type: 'income' }), 'in');
    assert.equal(convertDirection({ type: 'expense' }), 'out');
  });

  it('offers the other open accounts in the same currency', () => {
    const targets = convertTargets(
      [
        account('debit'),
        account('nu'),
        account('usd', { currency: 'USD' }),
        account('old', { archived: true }),
      ],
      source,
    );
    assert.deepEqual(
      targets.map((a) => a.id),
      ['nu'],
    );
  });

  it("starts on the best candidate's account", () => {
    const targets = [account('nu'), account('savings')];
    const candidates = [
      candidate('elsewhere', 'usd'),
      candidate('c1', 'savings'),
      candidate('c2', 'nu'),
    ];
    assert.deepEqual(initialConvertChoice(candidates, targets), {
      accountId: 'savings',
      candidateId: 'c1',
    });
    assert.deepEqual(initialConvertChoice([], targets), {
      accountId: null,
      candidateId: null,
    });
    assert.deepEqual(
      candidatesIn(candidates, 'nu').map((c) => c.id),
      ['c2'],
    );
    assert.deepEqual(candidatesIn(candidates, null), []);
  });

  it('builds the input, linking or creating the other side', () => {
    assert.deepEqual(convertInput(source, 'nu', null), {
      transactionId: 'tx',
      counterpartAccountId: 'nu',
      counterpartTransactionId: null,
    });
    assert.equal(
      convertInput(source, 'nu', 'c2').counterpartTransactionId,
      'c2',
    );
  });
});
