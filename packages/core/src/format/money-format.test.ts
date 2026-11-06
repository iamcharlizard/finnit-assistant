import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  MONEY_FORMATS,
  caretForTokens,
  completeMoneyValue,
  countMoneyTokens,
  formatMoneyText,
  moneyFormat,
  normalizeMoneyValue,
  sanitizeMoneyText,
} from './money-format';

const mx = MONEY_FORMATS.MX;
const co = MONEY_FORMATS.CO;
const cl = MONEY_FORMATS.CL;

describe('money format', () => {
  it('groups thousands with commas and millions with an apostrophe (MX)', () => {
    assert.equal(formatMoneyText('1', mx), '1');
    assert.equal(formatMoneyText('1000', mx), '1,000');
    assert.equal(formatMoneyText('200000', mx), '200,000');
    assert.equal(formatMoneyText('1250000.5', mx), "1'250,000.5");
    assert.equal(formatMoneyText('1000000000.00', mx), "1,000'000,000.00");
    assert.equal(formatMoneyText('0.', mx), '0.');
  });

  it('uses each country’s separators', () => {
    assert.equal(formatMoneyText('1250000.5', MONEY_FORMATS.US), '1,250,000.5');
    assert.equal(formatMoneyText('1250000.5', co), "1'250.000,5");
    assert.equal(formatMoneyText('1250000', cl), '1.250.000');
  });

  it('keeps only digits and one decimal separator while typing', () => {
    assert.equal(sanitizeMoneyText("$1'250,000.567", mx), '1250000.56');
    assert.equal(sanitizeMoneyText('abc12.3.4', mx), '12.34');
    assert.equal(sanitizeMoneyText('007', mx), '7');
    assert.equal(sanitizeMoneyText('.5', mx), '0.5');
    assert.equal(sanitizeMoneyText('12.', mx), '12.');
    assert.equal(sanitizeMoneyText('-50', mx), '50');
    // Comma is the decimal mark in Colombia; the dot groups.
    assert.equal(sanitizeMoneyText('1.250,75', co), '1250.75');
    // No cents in Chile.
    assert.equal(sanitizeMoneyText('1.250,75', cl), '125075');
  });

  it('reads stored values and fills the cents on blur', () => {
    assert.equal(normalizeMoneyValue('1,250,000.50'), '1250000.50');
    assert.equal(normalizeMoneyValue('$200'), '200');
    assert.equal(normalizeMoneyValue('10.999'), '10.99');
    assert.equal(completeMoneyValue('1200'), '1200.00');
    assert.equal(completeMoneyValue('12.5'), '12.50');
    assert.equal(completeMoneyValue(''), '');
    assert.equal(completeMoneyValue('12.', 0), '12');
  });

  it('keeps the caret after the same digits when separators appear', () => {
    // Typing the 4th digit of "1234": caret after 4 tokens → after "1,234".
    const display = formatMoneyText('1234', mx);
    assert.equal(caretForTokens(display, 4, mx), display.length);
    // Caret after "12" in "1,234" (2 tokens) → index 3.
    assert.equal(caretForTokens('1,234', 2, mx), 3);
    assert.equal(countMoneyTokens("1'250,0", mx), 5);
    assert.equal(countMoneyTokens('1,234.5', mx), 6);
  });

  it('overrides the currency of a country format', () => {
    const usdInMexico = moneyFormat('MX', 'USD');
    assert.equal(usdInMexico.currency, 'USD');
    assert.equal(usdInMexico.symbol, 'US$');
    assert.equal(usdInMexico.millionsSeparator, "'");
    assert.equal(moneyFormat('MX', 'MXN'), mx);
  });
});
