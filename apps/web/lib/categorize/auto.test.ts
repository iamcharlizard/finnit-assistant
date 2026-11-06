import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { autoCategorizeOutcome } from './auto';

describe('auto-categorize outcome', () => {
  const result = (categorized: number, suggested: number) => ({
    categorized,
    suggested,
    remaining: 10,
  });

  it('names what each mode did', () => {
    assert.equal(
      autoCategorizeOutcome('both', result(3, 5)),
      'categorizedAndSuggested',
    );
    assert.equal(autoCategorizeOutcome('both', result(3, 0)), 'categorized');
    assert.equal(autoCategorizeOutcome('history', result(3, 0)), 'categorized');
    assert.equal(autoCategorizeOutcome('ai', result(0, 5)), 'suggested');
    assert.equal(autoCategorizeOutcome('both', result(0, 5)), 'suggested');
    assert.equal(autoCategorizeOutcome('history', result(0, 0)), 'nothing');
  });
});
