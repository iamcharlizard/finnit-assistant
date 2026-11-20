import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  calcTokens,
  evaluateCalc,
  expressionFromAmount,
  hasOperation,
  pressCalcKey,
  type CalcKey,
} from './calculator';

const type = (keys: CalcKey[], from = '') => keys.reduce(pressCalcKey, from);

describe('calculator keys', () => {
  it('builds an expression key by key', () => {
    assert.equal(type(['1', '2', '0', '+', '3', '5']), '120+35');
  });

  it('replaces an operator typed twice and ignores one at the start', () => {
    assert.equal(type(['5', '+', '*', '2']), '5*2');
    assert.equal(type(['+', '-', '3']), '3');
  });

  it('keeps one decimal point and two decimals per amount', () => {
    assert.equal(type(['.', '5']), '0.5');
    assert.equal(type(['1', '.', '2', '.', '3', '4']), '1.23');
    assert.equal(type(['1', '.', '5', '+', '.', '2']), '1.5+0.2');
  });

  it('drops a dangling point before an operator', () => {
    assert.equal(type(['4', '.', '+', '1']), '4+1');
  });

  it('does not pile up leading zeros', () => {
    assert.equal(type(['0', '0', '7']), '7');
    assert.equal(type(['0', '.', '0', '7']), '0.07');
  });

  it('caps the whole digits of an amount', () => {
    const many = Array.from({ length: 12 }, () => '9' as const);
    assert.equal(type(many), '9999999999');
  });

  it('deletes, clears and works out', () => {
    assert.equal(type(['1', '2', 'back']), '1');
    assert.equal(type(['1', '+', '2', 'clear']), '');
    assert.equal(type(['1', '2', '0', '+', '3', '5', '*', '2', '=']), '190');
  });

  it('leaves the expression when "=" has no amount', () => {
    assert.equal(type(['5', '/', '0', '=']), '5/0');
  });
});

describe('calculator results', () => {
  it('multiplies and divides before adding and subtracting', () => {
    assert.equal(evaluateCalc('120+35*2'), 190);
    assert.equal(evaluateCalc('100-20/4'), 95);
    assert.equal(evaluateCalc('2*3+4*5'), 26);
  });

  it('rounds to cents', () => {
    assert.equal(evaluateCalc('10/3'), 3.33);
    assert.equal(evaluateCalc('0.1+0.2'), 0.3);
    assert.equal(evaluateCalc('1.005*1'), 1.01);
  });

  it('ignores a trailing operator or point', () => {
    assert.equal(evaluateCalc('120+'), 120);
    assert.equal(evaluateCalc('7.'), 7);
  });

  it('has no amount for nothing, a division by zero or below zero', () => {
    assert.equal(evaluateCalc(''), null);
    assert.equal(evaluateCalc('5/0'), null);
    assert.equal(evaluateCalc('5-8'), null);
  });

  it('tells operations and tokens apart', () => {
    assert.equal(hasOperation('120'), false);
    assert.equal(hasOperation('120+1'), true);
    assert.deepEqual(calcTokens('1.5*2'), [
      { kind: 'number', text: '1.5' },
      { kind: 'operator', operator: '*' },
      { kind: 'number', text: '2' },
    ]);
  });

  it('starts from a form amount only when it is one', () => {
    assert.equal(expressionFromAmount('1250.50'), '1250.50');
    assert.equal(expressionFromAmount(''), '');
    assert.equal(expressionFromAmount('abc'), '');
  });
});
