import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  addDaysToDateOnly,
  isDateOnly,
  parseDateOnly,
  toDateOnly,
} from './date-only';

describe('date-only helpers', () => {
  it('round-trips without shifting the day', () => {
    for (const value of [
      '2026-01-01',
      '2026-03-29',
      '2026-10-31',
      '2026-12-31',
    ]) {
      const date = parseDateOnly(value);
      assert.ok(date);
      assert.equal(toDateOnly(date), value);
    }
  });

  it('rejects malformed and overflowing dates', () => {
    assert.equal(parseDateOnly('2026-02-31'), undefined);
    assert.equal(parseDateOnly('2026-2-3'), undefined);
    assert.equal(parseDateOnly(''), undefined);
    assert.equal(isDateOnly('2028-02-29'), true);
    assert.equal(isDateOnly('2027-02-29'), false);
  });

  it('adds days across month and year boundaries', () => {
    assert.equal(addDaysToDateOnly('2026-12-31', 1), '2027-01-01');
    assert.equal(addDaysToDateOnly('2026-03-01', -1), '2026-02-28');
  });
});
