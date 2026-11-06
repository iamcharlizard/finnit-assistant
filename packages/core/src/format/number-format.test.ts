import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { sanitizeNumberText } from './number-format';

describe('sanitizeNumberText', () => {
  it('keeps whole numbers only by default', () => {
    assert.equal(sanitizeNumberText('12abc'), '12');
    assert.equal(sanitizeNumberText('1.5'), '15');
    assert.equal(sanitizeNumberText('-3'), '3');
    assert.equal(sanitizeNumberText('e'), '');
  });

  it('allows one decimal point (or comma) with limited digits', () => {
    const rate = { decimals: 4 };
    assert.equal(sanitizeNumberText('45.5%', rate), '45.5');
    assert.equal(sanitizeNumberText('24,75', rate), '24.75');
    assert.equal(sanitizeNumberText('1.2.3', rate), '1.23');
    assert.equal(sanitizeNumberText('.5', rate), '0.5');
    assert.equal(sanitizeNumberText('12.', rate), '12.');
    assert.equal(sanitizeNumberText('3.141592', rate), '3.1415');
  });

  it('limits the digits and allows a leading minus when asked', () => {
    assert.equal(sanitizeNumberText('315', { maxDigits: 2 }), '31');
    assert.equal(sanitizeNumberText('-12', { allowNegative: true }), '-12');
    assert.equal(sanitizeNumberText('1-2', { allowNegative: true }), '12');
    assert.equal(sanitizeNumberText('--5', { allowNegative: true }), '-5');
  });
});
