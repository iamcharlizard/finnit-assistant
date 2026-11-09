import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import type { ApiTransaction } from '../finance/types';
import { testLocalizer } from '../i18n/testing';
import { buildTransferInput } from '../new-entry/form';
import { deleteNotes } from '../transaction-detail/view';
import { NEW_LEG, legCandidatesArgs, legChoice } from '../transfers/legs';
import { mergePlan } from './view';

const es = testLocalizer('es');

const tx = (over: Partial<ApiTransaction>): ApiTransaction =>
  ({
    id: 'x',
    type: 'income',
    amount: 800,
    balanceEffect: 800,
    currency: 'MXN',
    txnDate: '2026-11-08T00:00:00.000Z',
    description: null,
    merchantName: null,
    displayName: null,
    isPrivate: false,
    isPending: false,
    inProcess: false,
    source: 'manual',
    accountId: 'mi-cuenta',
    account: {
      id: 'mi-cuenta',
      name: 'Mi Cuenta',
      type: 'debit',
      metadata: null,
    },
    category: null,
    ...over,
  }) as ApiTransaction;

describe('mergePlan', () => {
  const bank = tx({
    id: 'bank',
    source: 'imported',
    displayName: '71126 Enviada desde Revolut',
  });
  const manual = tx({
    id: 'manual',
    type: 'transfer',
    displayName: 'Café',
    txnDate: '2026-11-07T00:00:00.000Z',
  });

  it("keeps the bank's, offering the user's name first", () => {
    const plan = mergePlan(manual, bank, es);
    assert.equal(plan.keep.id, 'bank');
    assert.equal(plan.drop.id, 'manual');
    assert.equal(plan.keep.origin, 'Banco');
    assert.equal(plan.drop.category, 'Transferencia');
    assert.equal(plan.defaultName, 'drop');
    assert.deepEqual(
      plan.names.map((n) => n.label),
      ['Café', '71126 Enviada desde Revolut'],
    );
    assert.ok(!plan.blocked);
  });

  it('keeps the one on screen between two made by hand', () => {
    const other = tx({ id: 'other', displayName: 'Café' });
    const plan = mergePlan(manual, other, es);
    assert.equal(plan.keep.id, 'manual');
    // Same name: nothing to choose.
    assert.equal(plan.names.length, 1);
    assert.equal(plan.defaultName, 'keep');
  });

  it("can't merge two bank movements", () => {
    assert.ok(
      mergePlan(bank, tx({ id: 'b2', source: 'imported' }), es).blocked,
    );
  });
});

describe('deleteNotes', () => {
  it('says what else goes when deleting', () => {
    assert.deepEqual(
      deleteNotes(
        {
          source: 'imported',
          transferCounterpart: {
            transferId: 't',
            converted: false,
            transactionId: 'o',
            accountId: 'a',
            accountName: 'Revolut',
            direction: 'in',
            keptOnDelete: false,
          },
          loanPayment: null,
        },
        es.t,
      ),
      [
        'Es una transferencia: también se elimina el movimiento en Revolut y se ajusta su saldo.',
        'Vino del banco: no se volverá a importar. Si la cuenta está conectada, el banco lo sigue contando y aparecerá como «Diferencia con el banco».',
      ],
    );
    assert.deepEqual(
      deleteNotes(
        { source: 'manual', transferCounterpart: null, loanPayment: null },
        es.t,
      ),
      [],
    );
  });
});

describe('transfer legs', () => {
  it('searches once both accounts and an amount are there', () => {
    const draft = {
      fromAccountId: 'revolut',
      toAccountId: 'mi-cuenta',
      amount: '800',
      date: '2026-11-07',
    };
    assert.deepEqual(legCandidatesArgs(draft), {
      fromAccountId: 'revolut',
      toAccountId: 'mi-cuenta',
      amount: 800,
      date: '2026-11-07',
    });
    assert.equal(legCandidatesArgs({ ...draft, amount: '' }), null);
    assert.equal(legCandidatesArgs({ ...draft, toAccountId: 'revolut' }), null);
  });

  it('uses the only match unless the user says otherwise', () => {
    const one = [{ id: 'bank' }];
    assert.equal(legChoice(one, undefined), 'bank');
    assert.equal(legChoice(one, NEW_LEG), null);
    assert.equal(legChoice([{ id: 'a' }, { id: 'b' }], undefined), null);
    assert.equal(legChoice([{ id: 'a' }, { id: 'b' }], 'b'), 'b');
    // A pick that is no longer offered falls back.
    assert.equal(legChoice(one, 'gone'), 'bank');
  });

  it('sends the recorded sides with the transfer', () => {
    const input = buildTransferInput(
      {
        fromAccountId: 'revolut',
        toAccountId: 'mi-cuenta',
        amount: '800',
        date: '2026-11-07',
        description: '',
      } as never,
      'Transferencia',
      { to: 'bank' },
    );
    assert.equal(input.toTransactionId, 'bank');
    assert.ok(!('fromTransactionId' in input));
  });
});
