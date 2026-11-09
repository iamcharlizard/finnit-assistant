import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import type { ApiTransaction } from '../finance/types';
import type { EntryAccount } from '../new-entry/graphql';
import {
  canConvertToTransfer,
  canRecordCardPayment,
  candidatesIn,
  convertDirection,
  convertInput,
  convertTargets,
  initialConvertChoice,
  isNearCandidate,
  proposedCandidate,
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

const candidate = (
  id: string,
  accountId: string,
  txnDate = '2026-10-31T00:00:00.000Z',
) => ({ id, accountId, txnDate }) as ApiTransaction;

const source = {
  id: 'tx',
  type: 'expense',
  accountId: 'debit',
  currency: 'MXN',
  amount: 25_686,
  txnDate: '2026-11-03T00:00:00.000Z',
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
    assert.deepEqual(initialConvertChoice(candidates, targets, source), {
      accountId: 'savings',
      candidateId: 'c1',
    });
    assert.deepEqual(initialConvertChoice([], targets, source), {
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

  it('proposes only a candidate within a week', () => {
    // A card payment made on Friday the 31st shows up on Monday the 3rd.
    assert.equal(isNearCandidate(source, candidate('c', 'nu')), true);
    const far = candidate('old', 'nu', '2026-09-02T00:00:00.000Z');
    assert.equal(isNearCandidate(source, far), false);
    assert.deepEqual(initialConvertChoice([far], [account('nu')], source), {
      accountId: null,
      candidateId: null,
    });
    // Shown in its account, but not chosen for the user.
    assert.equal(proposedCandidate([far], 'nu', source), null);
    assert.equal(
      proposedCandidate([candidate('c', 'nu'), far], 'nu', source),
      'c',
    );
  });

  it('records a card payment only toward credit cards', () => {
    const accounts = [
      account('debit'),
      account('savings'),
      account('nu', { type: 'credit' }),
    ];
    assert.deepEqual(
      convertTargets(accounts, source, 'cardPayment').map((a) => a.id),
      ['nu'],
    );
    // Received on the card: it comes from any other account.
    const received = { ...source, type: 'income', accountId: 'nu' };
    assert.deepEqual(
      convertTargets(accounts, received, 'cardPayment').map((a) => a.id),
      ['debit', 'savings'],
    );
  });

  it('offers the card payment with a card to pay, or an income on a card', () => {
    assert.equal(canRecordCardPayment(source, 'debit', ['nu']), true);
    assert.equal(canRecordCardPayment(source, 'debit', []), false);
    // An expense on the only card can't pay that same card.
    const onCard = { ...source, accountId: 'nu' };
    assert.equal(canRecordCardPayment(onCard, 'credit', ['nu']), false);
    const income = { ...source, type: 'income' };
    assert.equal(canRecordCardPayment(income, 'credit', ['debit']), true);
    assert.equal(canRecordCardPayment(income, 'debit', ['nu']), false);
    assert.equal(
      canRecordCardPayment({ ...source, type: 'transfer' }, 'debit', ['nu']),
      false,
    );
  });
});
