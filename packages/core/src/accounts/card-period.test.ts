import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { testLocalizer } from '../i18n/testing';
import { paysLate, toCardPeriodView, type ApiCardPeriod } from './card-period';

const es = testLocalizer('es');

const period = (over: Partial<ApiCardPeriod> = {}): ApiCardPeriod => ({
  id: 'c1:2026-11-07',
  accountId: 'c1',
  periodStart: '2026-10-08T00:00:00.000Z',
  statementDate: '2026-11-07T00:00:00.000Z',
  paymentDueDate: '2026-11-27T00:00:00.000Z',
  balanceAtStatement: 7000,
  pendingInstallments: 0,
  installmentsInCycle: 0,
  installmentBalance: 0,
  cashBalance: 7000,
  installments: [],
  noInterestPayment: 7000,
  minimumPayment: null,
  paid: 3000,
  remaining: 4000,
  status: 'due',
  fromStatement: false,
  connected: false,
  interestEstimate: null,
  interestRecorded: false,
  interestCategoryId: 'interest',
  interestRateAnnual: 36,
  currency: 'MXN',
  ...over,
});

describe('credit card cycles', () => {
  it('says what is left to pay and by when', () => {
    const view = toCardPeriodView(period(), '2026-11-20', es);
    assert.equal(view.range, '8 oct – 7 nov');
    assert.equal(view.statusLabel, 'Por pagar');
    assert.equal(view.tone, 'warning');
    assert.equal(view.headline, 'Paga $4,000.00 antes del 27 nov');
    assert.equal(view.balanceLabel, 'Saldo al corte');
    assert.equal(view.progress, 43);
    assert.deepEqual(view.pay, {
      accountId: 'c1',
      amount: '4000.00',
      dueDate: '2026-11-27',
    });
    assert.equal(view.interest, null);
    assert.equal(
      view.historyHref,
      '/history?account=c1&from=2026-10-08&to=2026-11-07',
    );
    assert.ok(paysLate(view.pay!, '2026-11-28'));
    assert.ok(!paysLate(view.pay!, '2026-11-27'));
  });

  it('asks for the interest of an unpaid manual card, once', () => {
    const unpaid = period({ status: 'unpaid', interestEstimate: 46.4 });
    const view = toCardPeriodView(unpaid, '2026-11-28', es);
    assert.equal(view.tone, 'danger');
    assert.deepEqual(view.interest, {
      accountId: 'c1',
      categoryId: 'interest',
      amount: '46.40',
      estimate: '$46.40',
      currency: 'MXN',
    });
    assert.equal(
      toCardPeriodView({ ...unpaid, interestRecorded: true }, '2026-11-28', es)
        .interest,
      null,
    );
    assert.equal(
      toCardPeriodView({ ...unpaid, connected: true }, '2026-11-28', es)
        .interest,
      null,
    );
  });

  it('splits the payment in de contado and the installments of the cut-off', () => {
    assert.equal(toCardPeriodView(period(), '2026-11-20', es).split, null);
    const view = toCardPeriodView(
      period({
        noInterestPayment: 2000,
        installmentsInCycle: 1000,
        installmentBalance: 5000,
        cashBalance: 1000,
        installments: [
          {
            debtId: 'tv',
            name: 'Pantalla',
            number: 1,
            total: 6,
            amount: 1000,
            left: 5000,
          },
        ],
      }),
      '2026-11-20',
      es,
    );
    assert.deepEqual(view.split, {
      cash: '$1,000.00',
      installments: '$1,000.00',
      balance: '$5,000.00',
      plans: [
        {
          debtId: 'tv',
          label: 'Pantalla · 1 de 6',
          amount: '$1,000.00',
          left: 'Quedan $5,000.00',
          href: '/planning/debts/tv',
        },
      ],
    });
  });

  it('shows a running cycle without payment', () => {
    const view = toCardPeriodView(
      period({ status: 'open', paid: 0, remaining: 7000 }),
      '2026-11-05',
      es,
    );
    assert.equal(view.headline, 'Corta el 7 nov');
    assert.equal(view.balanceLabel, 'Saldo hasta hoy');
    assert.equal(view.progress, null);
    assert.equal(view.pay, null);
  });
});
