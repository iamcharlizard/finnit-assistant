import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { testLocalizer } from '@finnit/core/i18n/testing';
import { buildCreditUsageView } from './credit-usage';

const es = testLocalizer('es');

describe('credit used, split', () => {
  it('splits one-off spending and installments still to come', () => {
    const view = buildCreditUsageView(
      { used: 4000, installments: 1000, oneOff: 3000, outside: 600, plans: 2 },
      'MXN',
      es,
    );
    assert.equal(view?.installmentsPercent, 25);
    assert.equal(view?.oneOffPercent, 75);
    assert.equal(view?.plans, 2);
    assert.match(view?.outsideNote ?? '', /600/);
  });

  it('has nothing to split without purchases in installments', () => {
    assert.equal(
      buildCreditUsageView(
        { used: 4000, installments: 0, oneOff: 4000, outside: 0, plans: 0 },
        'MXN',
        es,
      ),
      null,
    );
  });
});
