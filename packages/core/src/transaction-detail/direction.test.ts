import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  buildDirectionInput,
  directionChangeOf,
  newDirectionForm,
  validateDirectionForm,
} from './direction';

describe('turning a movement into income or expense', () => {
  const name = {
    displayName: 'Mamá',
    original: 'SPEI MOBILE 4410293 REF 88',
  };

  it('offers the other kind for plain expenses and income', () => {
    assert.deepEqual(directionChangeOf({ id: 'm', type: 'expense', amount: -500, currency: 'MXN' }, name), {
      id: 'm',
      to: 'income',
      amount: 500,
      currency: 'MXN',
      patternGuess: 'SPEI MOBILE',
      nameGuess: 'Mamá',
    });
    assert.equal(
      directionChangeOf({ id: 'm', type: 'income', amount: 500, currency: 'MXN' }, name)?.to,
      'expense',
    );
    assert.equal(directionChangeOf({ id: 'm', type: 'transfer', amount: 500, currency: 'MXN' }, name), null);
    assert.equal(
      directionChangeOf(
        {
          id: 'm',
          type: 'expense',
          amount: 500,
          currency: 'MXN',
          cancelledAt: '2026-11-01',
        },
        name,
      ),
      null,
    );
  });

  it('names the rule after the pattern when the bank text is the name', () => {
    assert.equal(
      directionChangeOf(
        { id: 'm', type: 'expense', amount: 1, currency: 'MXN' },
        { displayName: name.original, original: name.original },
      )?.nameGuess,
      'SPEI MOBILE',
    );
  });

  it('remembers it only with a pattern and a name', () => {
    const change = directionChangeOf({ id: 'm', type: 'expense', amount: -500, currency: 'MXN' }, name)!;
    const form = newDirectionForm(change);
    assert.deepEqual(validateDirectionForm(form), {});
    assert.deepEqual(buildDirectionInput(change, form), {
      id: 'm',
      type: 'income',
    });
    const remember = { ...form, remember: true, pattern: ' ' };
    assert.deepEqual(validateDirectionForm(remember), {
      pattern: 'patternRequired',
    });
    assert.deepEqual(
      buildDirectionInput(change, { ...remember, pattern: ' MOBILE ' }),
      {
        id: 'm',
        type: 'income',
        remember: { pattern: 'MOBILE', displayName: 'Mamá' },
      },
    );
  });
});
