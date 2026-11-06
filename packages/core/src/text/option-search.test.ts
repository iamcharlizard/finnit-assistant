import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { normalizeSearch, optionScore, rankOptions } from './option-search';

// Categories as the pickers list them: parents first, children under them.
const options = [
  { label: 'Alimentos', group: 'Alimentos' },
  { label: 'Restaurantes', group: 'Alimentos', keywords: ['Alimentos'] },
  { label: 'Supermercado', group: 'Alimentos', keywords: ['Alimentos'] },
  { label: 'Hogar', group: 'Hogar' },
  { label: 'Seguro de salud', group: 'Hogar', keywords: ['Hogar'] },
  { label: 'Salud', group: 'Salud' },
  { label: 'Consultas médicas', group: 'Salud', keywords: ['Salud'] },
  { label: 'Farmacia', group: 'Salud', keywords: ['Salud'] },
  { label: 'Transporte', group: 'Transporte' },
  { label: 'Gasolina', group: 'Transporte', keywords: ['Transporte'] },
];

const labels = (query: string) =>
  rankOptions(options, query).map((o) => o.label);

describe('option search', () => {
  it('normalizes case, accents and spaces', () => {
    assert.equal(
      normalizeSearch('  Médicas   Consultas '),
      'medicas consultas',
    );
  });

  it('puts the label matches first, then what only its group matches', () => {
    assert.deepEqual(labels('Salud'), [
      'Salud',
      'Seguro de salud',
      'Consultas médicas',
      'Farmacia',
    ]);
  });

  it('finds a subcategory by a word of its name, without accents', () => {
    assert.deepEqual(labels('medic'), ['Consultas médicas']);
    assert.deepEqual(labels('gaso'), ['Gasolina']);
    assert.deepEqual(labels('far'), ['Farmacia']);
  });

  it('does not match scattered letters (no fuzzy noise)', () => {
    assert.deepEqual(labels('sld'), []);
    // "ga" starts Gasolina; it is not inside Hogar's or Alimentos' words.
    assert.deepEqual(labels('ga'), ['Gasolina', 'Hogar']);
  });

  it('every word must match: the label, or the parent', () => {
    assert.deepEqual(labels('salud farm'), ['Farmacia']);
    assert.deepEqual(labels('farm transporte'), []);
  });

  it('keeps every option for an empty query, and ties in order', () => {
    assert.equal(rankOptions(options, '  ').length, options.length);
    assert.equal(optionScore({ label: 'Hogar' }, ''), 1);
    assert.deepEqual(labels('alimentos').slice(1), [
      'Restaurantes',
      'Supermercado',
    ]);
  });
});
