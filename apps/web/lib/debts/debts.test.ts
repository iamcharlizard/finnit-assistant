import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import type { GqlRunner } from '@/lib/accounts/api';
import type { ApiAccount } from '@/lib/finance/types';
import { testLocalizer } from '@/lib/i18n/testing';
import {
  CREATE_DEBT_PAYMENT_MUTATION,
  CREATE_EXPENSE_MUTATION,
  CREATE_TRANSFER_MUTATION,
  DELETE_TRANSACTION_MUTATION,
  PaymentLinkError,
  debtErrorMessage,
  registerDebtPayment,
} from './api';
import {
  buildCreateDebtInput,
  buildPaymentMovement,
  buildUpdateDebtInput,
  formOfDebt,
  newDebtForm,
  newPaymentForm,
  parseRate,
  paymentMode,
  paymentSources,
  validateDebtForm,
  validatePaymentForm,
} from './form';
import { buildPayoffComparison, parseExtraPayment } from './payoff';
import type { ApiDebt, ApiPayoffProjection } from './types';
import { buildDebtsView, summarizeDebts } from './view';

const es = testLocalizer('es');
const en = testLocalizer('en');
const today = '2026-10-13';

const debt = (overrides: Partial<ApiDebt> = {}): ApiDebt => ({
  id: 'car',
  name: 'Crédito auto',
  kind: 'loan',
  principal: 100000,
  interestRateAnnual: 12,
  minPaymentAmount: 3000,
  startDate: '2025-01-01T00:00:00.000Z',
  dueDate: '2028-01-01T00:00:00.000Z',
  linkedAccountId: null,
  remainingBalance: 60000,
  totalPaid: 40000,
  createdAt: '2025-01-01T00:00:00.000Z',
  ...overrides,
});

const account = (overrides: Partial<ApiAccount> = {}): ApiAccount => ({
  id: 'debit',
  name: 'Nómina',
  type: 'debit',
  currency: 'MXN',
  balanceCurrent: 20000,
  archived: false,
  metadata: {
    bank: 'BBVA',
    last4: '1234',
    creditLimit: null,
    nickname: 'Mi nómina',
  },
  creditCardTerms: null,
  ...overrides,
});

const card = account({
  id: 'card',
  name: 'Oro',
  type: 'credit',
  balanceCurrent: -15000,
  metadata: {
    bank: 'BBVA',
    last4: '9999',
    creditLimit: 50000,
    nickname: 'Tarjeta oro',
  },
});

describe('summarizeDebts', () => {
  it('adds what is owed and the minimums of active debts, with a balance-weighted rate', () => {
    const totals = summarizeDebts([
      debt({
        remainingBalance: 60000,
        interestRateAnnual: 12,
        minPaymentAmount: 3000,
      }),
      debt({
        id: 'tdc',
        remainingBalance: 20000,
        interestRateAnnual: 48,
        minPaymentAmount: 1500,
      }),
      debt({
        id: 'mom',
        remainingBalance: 5000,
        interestRateAnnual: null,
        minPaymentAmount: null,
      }),
      debt({
        id: 'done',
        remainingBalance: 0,
        totalPaid: 100000,
        minPaymentAmount: 999,
      }),
    ]);
    assert.deepEqual(totals, {
      owed: 85000,
      minimums: 4500,
      // (60000·12 + 20000·48) / 80000
      weightedRate: 21,
      withoutRate: 1,
      active: 3,
    });
  });

  it('has no rate without rated debts', () => {
    assert.equal(
      summarizeDebts([debt({ interestRateAnnual: null })]).weightedRate,
      null,
    );
  });
});

describe('buildDebtsView', () => {
  const view = buildDebtsView(
    {
      debts: [
        debt({
          id: 'done',
          name: 'Viejo',
          remainingBalance: 0,
          totalPaid: 100000,
        }),
        debt(),
        debt({
          id: 'tdc',
          name: 'Tarjeta',
          kind: 'card',
          remainingBalance: 90000,
          linkedAccountId: 'card',
          dueDate: '2026-10-01T00:00:00.000Z',
        }),
      ],
      accounts: [account(), card],
    },
    { today },
    es,
  );

  it('lists debts still owed by balance, then paid-off ones', () => {
    assert.deepEqual(
      view.debts.map((d) => d.id),
      ['tdc', 'car', 'done'],
    );
    assert.deepEqual(view.activeIds, ['tdc', 'car']);
    assert.equal(view.totals.paidOff, 1);
  });

  it('formats each debt', () => {
    const car = view.debts[1]!;
    assert.equal(car.remaining, '$60,000.00');
    assert.equal(car.principal, '$100,000.00');
    assert.equal(car.paidPercent, 40);
    assert.equal(car.rate, '12%');
    assert.equal(car.minPayment, '$3,000.00');
    assert.equal(car.dueLabel, '1 de enero de 2028');
    assert.equal(car.overdue, false);
    const tdc = view.debts[0]!;
    assert.equal(tdc.accountLabel, 'Tarjeta oro');
    assert.equal(tdc.linkedToCard, true);
    assert.equal(tdc.overdue, true);
  });
});

describe('debt form', () => {
  it('validates the fields', () => {
    assert.deepEqual(validateDebtForm(newDebtForm()), {
      name: 'nameRequired',
      principal: 'principalRequired',
    });
    assert.deepEqual(
      validateDebtForm({
        ...newDebtForm(),
        name: 'X',
        principal: '1000',
        rate: '120',
        minPayment: '0',
        startDate: '2026-05-01',
        dueDate: '2026-04-01',
      }),
      {
        rate: 'rateInvalid',
        minPayment: 'minPaymentInvalid',
        dueDate: 'dueBeforeStart',
      },
    );
    assert.equal(
      validateDebtForm(
        { ...newDebtForm(), name: 'X', principal: '100' },
        { paid: 200 },
      ).principal,
      'principalBelowPaid',
    );
  });

  it('reads rates with a percent sign or a comma', () => {
    assert.equal(parseRate('36.5%'), 36.5);
    assert.equal(parseRate('24,9'), 24.9);
    assert.equal(parseRate('abc'), null);
  });

  it('builds the create input without empty fields', () => {
    assert.deepEqual(
      buildCreateDebtInput({
        ...newDebtForm(),
        name: ' Préstamo ',
        principal: '10,000',
        rate: '18',
        dueDate: '2027-01-31',
      }),
      {
        name: 'Préstamo',
        kind: 'loan',
        principal: 10000,
        interestRateAnnual: 18,
        dueDate: '2027-01-31',
      },
    );
  });

  it('sends only what changed on update, null to clear', () => {
    const initial = formOfDebt(debt({ linkedAccountId: 'debit' }));
    assert.equal(initial.startDate, '2025-01-01');
    assert.equal(buildUpdateDebtInput(initial, initial), null);
    assert.deepEqual(
      buildUpdateDebtInput(
        {
          ...initial,
          rate: '',
          linkedAccountId: '',
          kind: 'other',
          principal: '90000',
        },
        initial,
      ),
      {
        kind: 'other',
        principal: 90000,
        interestRateAnnual: null,
        linkedAccountId: null,
      },
    );
  });
});

describe('payments', () => {
  it('pays a debt linked to a credit card with a transfer from a non-credit account', () => {
    const mode = paymentMode({ linkedAccountId: 'card' }, [account(), card]);
    assert.equal(mode.kind, 'transfer');
    const sources = paymentSources(mode, [
      account(),
      card,
      account({ id: 'usd', currency: 'USD' }),
      account({ id: 'other-card', type: 'credit' }),
      account({ id: 'old', archived: true }),
    ]);
    assert.deepEqual(
      sources.map((a) => a.id),
      ['debit'],
    );
    const movement = buildPaymentMovement(
      {
        amount: '1,500',
        date: '2026-10-10',
        accountId: 'debit',
        categoryId: 'x',
      },
      {
        debt: debt(),
        mode,
        account: account(),
        description: 'Pago de Tarjeta',
      },
    );
    assert.deepEqual(movement, {
      kind: 'transfer',
      input: {
        fromAccountId: 'debit',
        toAccountId: 'card',
        amount: 1500,
        txnDate: '2026-10-10',
        description: 'Pago de Tarjeta',
      },
    });
  });

  it('pays any other debt with an expense, from any open account in pesos', () => {
    const mode = paymentMode({ linkedAccountId: null }, [account(), card]);
    assert.equal(mode.kind, 'expense');
    assert.deepEqual(
      paymentSources(mode, [
        account(),
        card,
        account({ id: 'usd', currency: 'USD' }),
      ]).map((a) => a.id),
      ['debit', 'card'],
    );
    const movement = buildPaymentMovement(
      {
        amount: '3000',
        date: '2026-10-10',
        accountId: 'debit',
        categoryId: '',
      },
      {
        debt: debt(),
        mode,
        account: account(),
        description: 'Pago de Crédito auto',
      },
    );
    assert.deepEqual(movement, {
      kind: 'expense',
      input: {
        accountId: 'debit',
        type: 'expense',
        amount: 3000,
        currency: 'MXN',
        txnDate: '2026-10-10',
        merchantName: 'Crédito auto',
        description: 'Pago de Crédito auto',
        categoryId: null,
      },
    });
  });

  it('starts with the minimum (capped at what is left) and validates', () => {
    assert.equal(
      newPaymentForm(debt({ minPaymentAmount: 3000, remainingBalance: 1200 }), {
        today,
      }).amount,
      '1200',
    );
    assert.deepEqual(
      validatePaymentForm(
        { amount: '70000', date: '2026-10-14', accountId: '', categoryId: '' },
        { remaining: 60000, today },
      ),
      {
        amount: 'amountTooMuch',
        date: 'dateInFuture',
        accountId: 'accountRequired',
      },
    );
  });
});

/** A fake GraphQL runner that records calls and answers by document. */
function fakeRunner(answers: Map<string, unknown | Error>) {
  const calls: { query: string; variables?: Record<string, unknown> }[] = [];
  const run: GqlRunner = async <T>(
    query: string,
    variables?: Record<string, unknown>,
  ) => {
    calls.push({ query, variables });
    const answer = answers.get(query);
    if (answer instanceof Error) throw answer;
    return answer as T;
  };
  return { run, calls };
}

describe('registerDebtPayment', () => {
  const expense = buildPaymentMovement(
    { amount: '500', date: '2026-10-10', accountId: 'debit', categoryId: '' },
    {
      debt: debt(),
      mode: { kind: 'expense' },
      account: account(),
      description: 'Pago',
    },
  );

  it('creates the movement, then the debt payment pointing at it', async () => {
    const { run, calls } = fakeRunner(
      new Map<string, unknown>([
        [CREATE_EXPENSE_MUTATION, { createTransaction: { id: 'txn-1' } }],
        [CREATE_DEBT_PAYMENT_MUTATION, { createDebtPayment: { id: 'p-1' } }],
      ]),
    );
    await registerDebtPayment('car', expense, run);
    assert.deepEqual(calls[1]!.variables, {
      input: {
        debtId: 'car',
        transactionId: 'txn-1',
        amount: 500,
        date: '2026-10-10',
      },
    });
  });

  it('links a transfer by its outgoing transaction', async () => {
    const transfer = buildPaymentMovement(
      { amount: '500', date: '2026-10-10', accountId: 'debit', categoryId: '' },
      {
        debt: debt(),
        mode: { kind: 'transfer', card },
        account: account(),
        description: 'Pago',
      },
    );
    const { run, calls } = fakeRunner(
      new Map<string, unknown>([
        [
          CREATE_TRANSFER_MUTATION,
          { createTransfer: { id: 't', fromTxnId: 'out-1' } },
        ],
        [CREATE_DEBT_PAYMENT_MUTATION, { createDebtPayment: { id: 'p-1' } }],
      ]),
    );
    await registerDebtPayment('car', transfer, run);
    assert.equal(
      (calls[1]!.variables!.input as { transactionId: string }).transactionId,
      'out-1',
    );
  });

  it('deletes the expense again when the payment is refused', async () => {
    const { run, calls } = fakeRunner(
      new Map<string, unknown>([
        [CREATE_EXPENSE_MUTATION, { createTransaction: { id: 'txn-1' } }],
        [
          CREATE_DEBT_PAYMENT_MUTATION,
          new Error(
            'Payment amount (500) exceeds remaining debt balance (100)',
          ),
        ],
        [DELETE_TRANSACTION_MUTATION, { deleteTransaction: true }],
      ]),
    );
    await assert.rejects(
      registerDebtPayment('car', expense, run),
      (error: unknown) => {
        assert.ok(error instanceof PaymentLinkError);
        assert.equal(error.undone, true);
        assert.equal(
          debtErrorMessage(error, es.t),
          'No pudimos registrar el pago: El pago es mayor que lo que te falta pagar. No se guardó ningún movimiento.',
        );
        return true;
      },
    );
    assert.deepEqual(calls[2]!.variables, { id: 'txn-1' });
  });
});

describe('debtErrorMessage', () => {
  it('explains why a debt with payments cannot be deleted', () => {
    assert.equal(
      debtErrorMessage(
        new Error('Cannot delete debt with existing payments'),
        en.t,
      ),
      "A debt with recorded payments can't be deleted.",
    );
  });
});

const step = (
  debtId: string,
  monthsToPayoff: number | null,
  totalInterest: number,
): ApiPayoffProjection => ({
  debtId,
  debtName: debtId.toUpperCase(),
  currentBalance: 1000,
  monthlyPayment: 100,
  payoffDate: '2027-01-01T00:00:00.000Z',
  totalInterest,
  monthsToPayoff,
});

describe('buildPayoffComparison', () => {
  it('compares months, interest and order on one bar scale', () => {
    const comparison = buildPayoffComparison(
      {
        avalanche: [step('tdc', 6, 300), step('car', 20, 1000)],
        snowball: [step('car', 10, 900), step('tdc', 21, 650)],
      },
      { today },
      es,
    );
    assert.equal(comparison.avalanche.months, 20);
    assert.equal(comparison.avalanche.debtFreeLabel, 'Junio 2028');
    assert.equal(comparison.avalanche.interest, '$1,300.00');
    assert.equal(comparison.snowball.months, 21);
    assert.equal(comparison.snowball.interest, '$1,550.00');
    assert.deepEqual(
      comparison.avalanche.steps.map((s) => [s.position, s.name, s.barPercent]),
      [
        [1, 'TDC', 29],
        [2, 'CAR', 95],
      ],
    );
    assert.equal(comparison.avalanche.steps[0]!.monthsLabel, '6 meses');
    assert.equal(comparison.better, 'avalanche');
    assert.equal(
      comparison.verdict,
      'Avalancha te ahorra $250.00 en intereses.',
    );
  });

  it('says when the plan never ends', () => {
    const comparison = buildPayoffComparison(
      { avalanche: [step('a', null, 0)], snowball: [step('a', null, 0)] },
      { today },
      en,
    );
    assert.equal(comparison.avalanche.months, null);
    assert.equal(comparison.avalanche.debtFreeLabel, null);
    assert.equal(comparison.avalanche.steps[0]!.monthsLabel, 'Never');
    assert.equal(comparison.better, null);
  });

  it('calls a tie a tie', () => {
    const plan = [step('a', 5, 0)];
    const comparison = buildPayoffComparison(
      { avalanche: plan, snowball: plan },
      { today },
      en,
    );
    assert.equal(comparison.better, null);
    assert.equal(
      comparison.verdict,
      'With your debts, both strategies give the same result.',
    );
  });

  it('reads the extra payment', () => {
    assert.equal(parseExtraPayment(''), 0);
    assert.equal(parseExtraPayment('1,500'), 1500);
    assert.equal(parseExtraPayment('-5'), null);
    assert.equal(parseExtraPayment('abc'), null);
  });
});
