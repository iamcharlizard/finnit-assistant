import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { testLocalizer } from '@finnit/core/i18n/testing';
import type { ApiAccount } from '@finnit/core/finance/types';
import {
  billedInstallments,
  buildCardInstallmentInput,
  cardScheduleRows,
  moveInstallment,
  schedulePage,
  withScheduleRowChange,
  cardInstallmentPreview,
  cardInstallmentSpan,
  installmentDays,
  newCardInstallmentForm,
  validateCardInstallmentForm,
  withCardInstallmentChange,
} from './card-installments';
import {
  cardInstallmentPrefill,
  initialCardInstallmentChoice,
  linkCardInstallment,
  toCardInstallmentLinkView,
  unlinkCardInstallment,
  type ApiCardInstallmentLinkOptions,
} from './card-installment-links';

const es = testLocalizer('es');
const today = '2026-11-09';

const card: ApiAccount = {
  id: 'card',
  name: 'Oro',
  type: 'credit',
  currency: 'MXN',
  balanceCurrent: -6000,
  archived: false,
  metadata: null,
  creditCardTerms: { statementDay: 7, paymentDueDay: 27 },
};
const accounts = [card];

describe('card purchases in installments', () => {
  it('bills them on the cut-offs, like the API', () => {
    assert.deepEqual(installmentDays('2026-10-20', 3, { statementDay: 7 }), [
      '2026-11-07',
      '2026-12-07',
      '2027-01-07',
    ]);
    assert.deepEqual(installmentDays('2026-12-20', 3, { statementDay: 31 }), [
      '2026-12-31',
      '2027-01-31',
      '2027-02-28',
    ]);
    assert.deepEqual(installmentDays('2026-01-31', 2, null), [
      '2026-02-28',
      '2026-03-31',
    ]);
    assert.equal(
      billedInstallments('2026-06-10', 12, { statementDay: 7 }, today),
      5,
    );
  });

  it('works out the installments billed until the user types them', () => {
    let form = newCardInstallmentForm(today);
    form = withCardInstallmentChange(
      form,
      { accountId: 'card', months: '12', purchaseDate: '2026-06-10' },
      { accounts, today },
    );
    assert.equal(form.installmentsPaid, '5');
    form = withCardInstallmentChange(
      form,
      { installmentsPaid: '4' },
      { accounts, today },
    );
    form = withCardInstallmentChange(
      form,
      { purchaseDate: '2026-01-10' },
      { accounts, today },
    );
    assert.equal(form.installmentsPaid, '4');
  });

  it('previews equal installments, or the terms with interest', () => {
    const form = {
      ...newCardInstallmentForm(today),
      accountId: 'card',
      principal: '6000',
      months: '6',
      purchaseDate: '2026-10-20',
    };
    assert.deepEqual(cardInstallmentPreview(form), {
      installmentAmount: 1000,
      totalToRepay: 6000,
      interest: 0,
      fees: 0,
    });
    assert.deepEqual(cardInstallmentSpan(form, accounts), {
      first: '2026-11-07',
      last: '2027-04-07',
    });
    const withRate = cardInstallmentPreview({
      ...form,
      withInterest: true,
      interestMode: 'rate',
      rate: '30',
    })!;
    assert.ok(withRate.totalToRepay > 6000);
  });

  it('validates and builds the input', () => {
    const empty = validateCardInstallmentForm(newCardInstallmentForm(today), {
      today,
    });
    assert.deepEqual(Object.keys(empty).sort(), [
      'accountId',
      'months',
      'name',
      'principal',
    ]);
    const form = {
      ...newCardInstallmentForm(today, { purchaseTransactionId: 'tx' }),
      name: ' Pantalla ',
      accountId: 'card',
      principal: '6000',
      months: '6',
      purchaseDate: '2026-10-20',
      installmentsPaid: '9',
    };
    assert.equal(
      validateCardInstallmentForm(form, { today }).installmentsPaid,
      'installmentsPaidTooMany',
    );
    assert.deepEqual(
      buildCardInstallmentInput({ ...form, installmentsPaid: '1' }),
      {
        name: 'Pantalla',
        kind: 'loan',
        loanType: 'card_installments',
        principal: 6000,
        linkedAccountId: 'card',
        startDate: '2026-10-20',
        installmentsTotal: 6,
        installmentsPaid: 1,
        purchaseTransactionId: 'tx',
        interestMode: 'total_amount',
        totalToRepay: 6000,
      },
    );
    assert.equal(
      buildCardInstallmentInput({
        ...form,
        installmentsPaid: '0',
        withInterest: true,
        interestMode: 'installment_amount',
        installmentAmount: '1100',
      }).installmentAmount,
      1100,
    );
  });
});

describe('the installments of a card purchase', () => {
  const base = withCardInstallmentChange(
    newCardInstallmentForm(today),
    {
      accountId: 'card',
      principal: '998',
      months: '3',
      purchaseDate: '2026-10-07',
    },
    { accounts, today },
  );

  it('lists them on the cut-offs, the last with the cents left', () => {
    assert.deepEqual(cardScheduleRows(base, accounts), [
      { day: '2026-10-07', amount: '332.66' },
      { day: '2026-11-07', amount: '332.66' },
      { day: '2026-12-07', amount: '332.68' },
    ]);
  });

  it('moves the next ones with a date, changes one amount, and starts over with the terms', () => {
    let form = withScheduleRowChange(
      base,
      0,
      { day: '2026-10-07' },
      { accounts, today },
    );
    form = withScheduleRowChange(
      form,
      1,
      { day: '2026-10-17' },
      { accounts, today },
    );
    form = withScheduleRowChange(
      form,
      2,
      { amount: '340' },
      { accounts, today },
    );
    assert.deepEqual(form.schedule, [
      { day: '2026-10-07', amount: '332.66' },
      { day: '2026-10-17', amount: '332.66' },
      { day: '2026-11-17', amount: '340' },
    ]);
    // Billed by today (Nov 9): the first two.
    assert.equal(form.installmentsPaid, '2');
    assert.deepEqual(
      validateCardInstallmentForm({ ...form, name: 'X' }, { today }),
      {},
    );
    assert.deepEqual(
      (
        buildCardInstallmentInput({ ...form, name: 'X' })
          .installmentSchedule as unknown[]
      )[2],
      { dueDate: '2026-11-17', amount: 340 },
    );
    const restarted = withCardInstallmentChange(
      form,
      { months: '6' },
      { accounts, today },
    );
    assert.equal(restarted.schedule, null);
    assert.equal(
      validateCardInstallmentForm(
        {
          ...form,
          name: 'X',
          schedule: [
            { day: '2026-10-07', amount: '100' },
            { day: '2026-10-17', amount: '100' },
            { day: '2026-11-17', amount: '100' },
          ],
        },
        { today },
      ).schedule,
      'scheduleBelowPrincipal',
    );
  });

  it('moves days like the API and pages long lists', () => {
    assert.deepEqual(
      moveInstallment(
        ['2026-10-16', '2026-11-16', '2026-12-16'],
        0,
        '2026-10-31',
        true,
      ),
      ['2026-10-31', '2026-11-30', '2026-12-31'],
    );
    const rows = Array.from({ length: 24 }, (_, i) => i);
    assert.deepEqual(schedulePage(rows, 1), {
      rows: [6, 7, 8, 9, 10, 11],
      start: 6,
      pages: 4,
    });
    assert.equal(schedulePage(rows, 9).start, 18);
  });
});

describe('linking an expense to a card purchase in installments', () => {
  const options: ApiCardInstallmentLinkOptions = {
    accountId: 'card',
    linked: null,
    suggestedDebtId: 'tv',
    suggestedOccurrenceId: 'o2',
    plans: [
      {
        debtId: 'tv',
        name: 'Pantalla',
        principal: 6000,
        installmentsTotal: 6,
        installmentAmount: 1000,
        purchaseDate: '2026-10-20T00:00:00.000Z',
        purchaseLinked: false,
        canLinkPurchase: false,
        purchaseFits: false,
        nameMatches: true,
        installments: [
          {
            occurrenceId: 'o1',
            number: 1,
            dueDate: '2026-11-07T00:00:00.000Z',
            amount: 1000,
            fits: false,
            state: 'paid_without_movement',
          },
          {
            occurrenceId: 'o2',
            number: 2,
            dueDate: '2026-12-07T00:00:00.000Z',
            amount: 1000,
            fits: true,
            state: 'open',
          },
        ],
      },
    ],
  };

  it('lists the installments that fit first, the suggested one picked', () => {
    assert.deepEqual(initialCardInstallmentChoice(options), {
      kind: 'installment',
      debtId: 'tv',
      occurrenceId: 'o2',
    });
    const view = toCardInstallmentLinkView(options, 'MXN', es);
    assert.equal(view.linked, null);
    assert.deepEqual(
      view.plans[0]!.rows.map((r) => [r.title, r.meta, r.proposed]),
      [
        ['Mensualidad 2 de 6', '$1,000.00 · corte del 7 dic', true],
        ['Mensualidad 1 de 6', '$1,000.00 · cobrada sin movimiento', false],
      ],
    );
  });

  it('says what it is linked to, and the purchase when it is the purchase', () => {
    const view = toCardInstallmentLinkView(
      {
        ...options,
        linked: {
          debtId: 'tv',
          name: 'Pantalla',
          purchase: false,
          occurrenceId: 'o2',
          number: 2,
          installmentsTotal: 6,
        },
      },
      'MXN',
      es,
    );
    assert.equal(view.linked, 'Es la mensualidad 2 de 6 de Pantalla.');
    const purchase = toCardInstallmentLinkView(
      {
        ...options,
        suggestedOccurrenceId: null,
        plans: [
          { ...options.plans[0]!, canLinkPurchase: true, purchaseFits: true },
        ],
      },
      'MXN',
      es,
    );
    assert.equal(purchase.plans[0]!.rows[0]!.title, 'Es la compra completa');
    assert.equal(purchase.plans[0]!.rows[0]!.proposed, true);
  });

  it('runs the purchase or the installment mutation', async () => {
    const calls: [string, unknown][] = [];
    const run = async <T>(query: string, variables?: unknown) => {
      calls.push([query.slice(9, 40), variables]);
      return {} as T;
    };
    await linkCardInstallment('tx', { kind: 'purchase', debtId: 'tv' }, run);
    await linkCardInstallment(
      'tx',
      { kind: 'installment', debtId: 'tv', occurrenceId: 'o2' },
      run,
    );
    await unlinkCardInstallment(
      {
        debtId: 'tv',
        name: 'Pantalla',
        purchase: true,
        occurrenceId: null,
        number: null,
        installmentsTotal: 6,
      },
      run,
    );
    assert.deepEqual(
      calls.map(([, v]) => v),
      [
        { debtId: 'tv', transactionId: 'tx' },
        { occurrenceId: 'o2', transactionId: 'tx' },
        { debtId: 'tv' },
      ],
    );
  });

  it('fills the new purchase from the expense', () => {
    assert.deepEqual(
      cardInstallmentPrefill({
        id: 'tx',
        accountId: 'card',
        amount: 6000,
        txnDate: '2026-10-20T18:00:00.000Z',
        name: 'Liverpool',
      }),
      {
        name: 'Liverpool',
        accountId: 'card',
        principal: '6000.00',
        purchaseDate: '2026-10-20',
        purchaseTransactionId: 'tx',
      },
    );
  });
});
