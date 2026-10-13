import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DARK_TEXT,
  LIGHT_TEXT,
  contrastRatio,
  isHexColor,
  normalizeHex,
  readableTextColor,
  relativeLuminance,
} from './color';

describe('normalizeHex / isHexColor', () => {
  it('expands short hex and uppercases', () => {
    assert.equal(normalizeHex('#abc'), '#AABBCC');
    assert.equal(normalizeHex('00f5ff'), '#00F5FF');
  });

  it('rejects invalid colors', () => {
    assert.equal(isHexColor('#12345'), false);
    assert.equal(isHexColor('red'), false);
    assert.equal(isHexColor('#00F5FF'), true);
    assert.throws(() => normalizeHex('#ggg'));
  });
});

describe('relativeLuminance / contrastRatio', () => {
  it('matches the WCAG extremes', () => {
    assert.equal(relativeLuminance('#000000'), 0);
    assert.equal(relativeLuminance('#FFFFFF'), 1);
    assert.equal(contrastRatio('#000000', '#FFFFFF'), 21);
  });

  it('is symmetric', () => {
    assert.equal(
      contrastRatio('#5B61C2', '#FFFFFF'),
      contrastRatio('#FFFFFF', '#5B61C2'),
    );
  });

  it('matches the token comment in globals.css (white on #5b61c2 ≈ 5.3:1)', () => {
    const ratio = contrastRatio('#FFFFFF', '#5b61c2');
    assert.ok(ratio > 5.2 && ratio < 5.4, `got ${ratio}`);
  });
});

describe('readableTextColor', () => {
  it('uses white on dark backgrounds', () => {
    assert.equal(readableTextColor('#12131A'), LIGHT_TEXT);
    assert.equal(readableTextColor('#5B61C2'), LIGHT_TEXT);
    assert.equal(readableTextColor('#BA1A1A'), LIGHT_TEXT);
  });

  it('uses dark text on light backgrounds', () => {
    assert.equal(readableTextColor('#FFFFFF'), DARK_TEXT);
    assert.equal(readableTextColor('#00F5FF'), DARK_TEXT);
    assert.equal(readableTextColor('#FFD600'), DARK_TEXT);
  });

  it('picks the color that passes AA on both gradient stops', () => {
    // Both stops dark: white passes on both.
    assert.equal(readableTextColor(['#1A1B22', '#5B61C2']), LIGHT_TEXT);
    // Both stops light: dark passes on both.
    assert.equal(readableTextColor(['#00F5FF', '#FFFFFF']), DARK_TEXT);
  });

  it('falls back to the best worst-case contrast when nothing passes on both', () => {
    // Black to white: neither candidate reaches 4.5:1 on both stops.
    const choice = readableTextColor(['#000000', '#FFFFFF']);
    const worst = (text: string) =>
      Math.min(contrastRatio(text, '#000000'), contrastRatio(text, '#FFFFFF'));
    const other = choice === LIGHT_TEXT ? DARK_TEXT : LIGHT_TEXT;
    assert.ok(worst(choice) >= worst(other));
  });

  it('accepts short hex', () => {
    assert.equal(readableTextColor('#000'), LIGHT_TEXT);
    assert.equal(readableTextColor('#fff'), DARK_TEXT);
  });
});
