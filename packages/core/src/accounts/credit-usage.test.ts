import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { testLocalizer } from '@finnit/core/i18n/testing';
import { buildCreditUsageView } from './credit-usage';

const es = testLocalizer('es');

describe('credit used, split', () => {
  it('adds the installments the card does not have yet to what it owes', () => {
    // Owes 32,887.02: 5,098 still to bill of a purchase charged whole, the
    // rest one-off; 5,416.47 more of purchases billed month by month.
    const view = buildCreditUsageView(
      {
        used: 32887.02,
        installments: 5098,
        oneOff: 27789.02,
        outside: 5416.47,
        plans: 10,
      },
      'MXN',
      77000,
      es,
    )!;
    assert.match(view.total, /38,303\.49/);
    assert.match(view.oneOff, /27,789\.02/);
    assert.match(view.installments, /10,514\.47/);
    assert.equal(view.oneOffPercent + view.installmentsPercent, 100);
    assert.equal(view.ofLimit?.total, 50);
    assert.equal(view.plans, 10);
  });

  it('has nothing to split without purchases in installments', () => {
    assert.equal(
      buildCreditUsageView(
        { used: 4000, installments: 0, oneOff: 4000, outside: 0, plans: 0 },
        'MXN',
        null,
        es,
      ),
      null,
    );
  });
});
