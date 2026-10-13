import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import type { ApiAccount } from '@/lib/finance/types';
import { buildCardDetail, buildCards, pickCard } from './view';

const account = (overrides: Partial<ApiAccount>): ApiAccount => ({
  id: 'a',
  name: 'Cuenta',
  type: 'debit',
  currency: 'MXN',
  balanceCurrent: 0,
  archived: false,
  metadata: null,
  creditCardTerms: null,
  ...overrides,
});

describe('buildCards', () => {
  const cards = buildCards(
    [
      account({ id: 'cash', type: 'cash' }),
      account({
        id: 'deb',
        balanceCurrent: 5400,
        metadata: { bank: 'BBVA', last4: '1234', creditLimit: null },
      }),
      account({
        id: 'tdc',
        type: 'credit',
        name: 'Oro',
        balanceCurrent: -12450,
        creditCardTerms: { statementDay: 20, paymentDueDay: 10 },
      }),
    ],
    [
      {
        institution: 'Banamex',
        accounts: [
          {
            accountId: 'tdc',
            mask: '8824',
            creditLimit: 20000,
            availableCredit: 7550,
          },
        ],
      },
    ],
  );

  it('shows credit and debit accounts, credit first, with bank data', () => {
    assert.deepEqual(
      cards.map((c) => [c.id, c.tier, c.maskedNumber, c.bankName, c.balance]),
      [
        ['tdc', 'CRÉDITO', '•••• •••• •••• 8824', 'Banamex', '$12,450.00'],
        ['deb', 'DÉBITO', '•••• •••• •••• 1234', 'BBVA', '$5,400.00'],
      ],
    );
    assert.deepEqual(cards[0]!.credit, {
      owed: 12450,
      limit: 20000,
      available: '$7,550.00',
    });
    assert.equal(pickCard(cards, 'deb')?.id, 'deb');
    assert.equal(pickCard(cards, 'nope')?.id, 'tdc');
  });

  it('lists cut-off and payment dates and the recurring charges', () => {
    const detail = buildCardDetail(cards[0]!, {
      today: '2026-10-14',
      monthLabel: 'Octubre 2026',
      monthSpending: 3200,
      recent: [],
      summary: {
        recurringExpected: 398,
        recurringPaid: 199,
        recurringPayments: [{ name: 'Netflix' }, { name: 'Spotify' }],
        statement: null,
      },
    });
    assert.deepEqual(detail.facts, [
      { label: 'Próximo corte', value: '20 oct · En 6 días' },
      { label: 'Próxima fecha de pago', value: '10 nov · En 27 días' },
    ]);
    assert.equal(detail.monthSpending, '$3,200.00');
    assert.deepEqual(detail.recurring, {
      expected: '$398.00',
      paid: '$199.00',
      count: 2,
    });
  });
});
