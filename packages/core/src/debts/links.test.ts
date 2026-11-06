import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { testLocalizer } from '@finnit/core/i18n/testing';
import { GraphqlRequestError } from '@finnit/core/graphql/request';
import { debtErrorMessage } from './api';
import {
  buildExpenseCandidateRows,
  buildLinkOptionsView,
  linkLoanPayment,
  loadLoanExpenseCandidates,
  unlinkLoanPayment,
  type ApiLoanLinkOptions,
} from './links';

const es = testLocalizer('es');

const options: ApiLoanLinkOptions = {
  suggestedDebtId: 'didi',
  loans: [
    {
      debtId: 'didi',
      name: 'Préstamo DiDi',
      lenderName: 'DiDi',
      suggestedOccurrenceId: 'o2',
      payments: [
        {
          occurrenceId: 'o1',
          dueDate: '2026-10-03T00:00:00.000Z',
          amount: 990.19,
          state: 'paid_without_movement',
        },
        {
          occurrenceId: 'o2',
          dueDate: '2026-11-03T00:00:00.000Z',
          amount: 990.19,
          state: 'open',
        },
      ],
    },
    {
      debtId: 'kubo',
      name: 'Kubo',
      lenderName: 'Kubo',
      suggestedOccurrenceId: null,
      payments: [
        {
          occurrenceId: 'k1',
          dueDate: '2026-11-20T00:00:00.000Z',
          amount: 1500,
          state: 'open',
        },
      ],
    },
  ],
};

describe('loan links: from the movement', () => {
  it('starts on the suggested loan and payment', () => {
    const view = buildLinkOptionsView(options, es);
    assert.equal(view.initialDebtId, 'didi');
    assert.equal(view.initialOccurrenceId, 'o2');
    assert.equal(view.loans[0]!.label, 'Préstamo DiDi · DiDi');
    assert.equal(view.loans[1]!.label, 'Kubo');
    assert.deepEqual(
      view.loans[0]!.payments.map((p) => [p.dueDate, p.state, p.suggested]),
      [
        ['2026-10-03', 'paid_without_movement', false],
        ['2026-11-03', 'open', true],
      ],
    );
    assert.equal(view.loans[0]!.payments[1]!.amountLabel, '$990.19');
  });

  it('without a suggestion, picks nothing unless there is one loan', () => {
    const none = buildLinkOptionsView(
      { ...options, suggestedDebtId: null },
      es,
    );
    assert.equal(none.initialDebtId, null);
    const one = buildLinkOptionsView(
      { suggestedDebtId: null, loans: [options.loans[1]!] },
      es,
    );
    assert.equal(one.initialDebtId, 'kubo');
    assert.equal(one.initialOccurrenceId, 'k1');
  });
});

describe('loan links: from the loan', () => {
  it('lists the candidates with date and account', () => {
    const rows = buildExpenseCandidateRows(
      [
        {
          transactionId: 't1',
          date: '2026-11-03T00:00:00.000Z',
          amount: 990.19,
          description: 'DIDI*PRESTAMOS 2',
          accountName: 'Mi Cuenta',
          nameMatch: true,
          exactAmount: true,
          score: 1,
        },
      ],
      '2026-11-06',
      es,
    );
    assert.equal(rows[0]!.meta, '3 de noviembre · Mi Cuenta');
    assert.equal(rows[0]!.amountLabel, '$990.19');
  });

  it('runs the queries and mutations with their variables', async () => {
    const calls: [string, Record<string, unknown> | undefined][] = [];
    const run = async <T>(
      query: string,
      variables?: Record<string, unknown>,
    ) => {
      calls.push([query.split('(')[0]!, variables]);
      return { loanExpenseCandidates: [] } as T;
    };
    await loadLoanExpenseCandidates('o1', '  ', run);
    await linkLoanPayment('o1', 't1', run);
    await unlinkLoanPayment('o1', true, run);
    assert.deepEqual(calls, [
      ['query LoanExpenseCandidates', { occurrenceId: 'o1', search: null }],
      ['mutation LinkLoanPayment', { occurrenceId: 'o1', transactionId: 't1' }],
      ['mutation UnlinkLoanPayment', { occurrenceId: 'o1', keepPaid: true }],
    ]);
  });

  it("shows the API's link errors in the user's language", () => {
    const error = new GraphqlRequestError(
      'This payment is already linked to a movement; unlink it first',
      'CONFLICT',
    );
    assert.equal(
      debtErrorMessage(error, es.t),
      'Ese pago ya tiene un gasto ligado; deslígalo primero.',
    );
  });
});
