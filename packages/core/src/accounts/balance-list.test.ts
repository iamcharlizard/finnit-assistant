import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { testLocalizer } from '@finnit/core/i18n/testing';
import { buildAccountBalanceList } from './balance-list';
import { buildAccounts } from './view';
import type { ApiAccount } from '../finance/types';

const es = testLocalizer('es');

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

describe('balance list', () => {
  it('groups cards first, with what they owe, the limit used and the payment day', () => {
    const accounts = buildAccounts(
      [
        account({ id: 'nomina', name: 'Nómina', balanceCurrent: 1500 }),
        account({
          id: 'explora',
          name: 'Explora',
          type: 'credit',
          balanceCurrent: -7700,
          metadata: { bank: null, last4: null, creditLimit: 77000 },
          creditCardTerms: {
            statementDay: 16,
            paymentDueDay: 9,
            interestRateAnnual: null,
          },
        }),
      ],
      [],
      es,
    );
    const groups = buildAccountBalanceList(accounts, '2026-11-16', es);
    assert.deepEqual(
      groups.map((g) => g.key),
      ['credit', 'debit'],
    );
    const card = groups[0]!.rows[0]!;
    assert.equal(card.usedPercent, 10);
    assert.equal(card.tone, 'expense');
    assert.match(card.nextPayment ?? '', /9 dic/);
    assert.equal(groups[1]!.rows[0]!.tone, 'default');
  });
});
