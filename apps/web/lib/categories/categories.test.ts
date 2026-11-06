import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { categoryOptions } from '@/lib/new-entry/options';
import { categoryInput, validateCategoryForm } from './api';
import type { SettingsCategory } from './types';
import { categoryTree, isInUse, moveTargets, parentOptions } from './view';

const cat = (
  id: string,
  overrides: Partial<SettingsCategory> = {},
): SettingsCategory => ({
  id,
  name: id,
  parentId: null,
  key: null,
  kind: 'expense',
  icon: null,
  sortOrder: null,
  isDefault: true,
  hidden: false,
  editable: false,
  ...overrides,
});

const CATEGORIES: SettingsCategory[] = [
  cat('Vivienda', { sortOrder: 1, icon: 'housing' }),
  cat('Renta', { parentId: 'Vivienda', sortOrder: 1 }),
  cat('Comida', { sortOrder: 3, icon: 'food' }),
  cat('Supermercado', { parentId: 'Comida', sortOrder: 1 }),
  cat('Botanas', {
    parentId: 'Comida',
    isDefault: false,
    editable: true,
  }),
  cat('Mascotas', { isDefault: false, editable: true, icon: 'pets' }),
  cat('Ingresos', { kind: 'income', sortOrder: 20, icon: 'income' }),
  cat('Sueldo', { kind: 'income', parentId: 'Ingresos' }),
];

describe('category tree', () => {
  it('lists the catalog in its order, then own categories, by kind', () => {
    const tree = categoryTree(CATEGORIES, 'expense', { Renta: 2 }, 'es');
    assert.deepEqual(
      tree.map((g) => [g.name, g.children.map((c) => c.name)]),
      [
        ['Vivienda', ['Renta']],
        ['Comida', ['Supermercado', 'Botanas']],
        ['Mascotas', []],
      ],
    );
    assert.equal(tree[0]!.children[0]!.count, 2);
    // A subcategory without an icon of its own takes its parent's.
    assert.equal(tree[1]!.children[1]!.iconKey, 'food');
    assert.equal(tree[2]!.iconKey, 'pets');
    assert.deepEqual(
      categoryTree(CATEGORIES, 'income', {}, 'es').map((g) => g.name),
      ['Ingresos'],
    );
  });

  it('offers main categories of the same kind as parents', () => {
    assert.deepEqual(
      parentOptions(CATEGORIES, 'expense', 'Mascotas').map((c) => c.id),
      ['Vivienda', 'Comida'],
    );
    assert.deepEqual(
      parentOptions(CATEGORIES, 'income').map((c) => c.id),
      ['Ingresos'],
    );
  });

  it('moves a deleted category only to another of its kind', () => {
    const targets = moveTargets(CATEGORIES, { id: 'Comida', kind: 'expense' });
    const ids = targets.map((c) => c.id);
    assert.ok(!ids.includes('Comida'));
    assert.ok(!ids.includes('Supermercado'));
    assert.ok(!ids.includes('Sueldo'));
    assert.ok(ids.includes('Renta'));
    assert.equal(
      isInUse({
        transactions: 0,
        children: 0,
        budgetCaps: 0,
        rules: 0,
        aliases: 0,
        recurring: 0,
      }),
      false,
    );
    assert.equal(
      isInUse({
        transactions: 0,
        children: 0,
        budgetCaps: 0,
        rules: 1,
        aliases: 0,
        recurring: 0,
      }),
      true,
    );
  });
});

describe('category form', () => {
  it('needs a name of at most 60 characters', () => {
    const form = {
      name: '  ',
      kind: 'expense' as const,
      parentId: '',
      icon: '',
    };
    assert.equal(validateCategoryForm(form), 'nameRequired');
    assert.equal(
      validateCategoryForm({ ...form, name: 'x'.repeat(61) }),
      'nameTooLong',
    );
    assert.equal(validateCategoryForm({ ...form, name: 'Gym' }), null);
  });

  it("sends the kind only for a main category (a sub takes its parent's)", () => {
    assert.deepEqual(
      categoryInput({ name: ' Gym ', kind: 'expense', parentId: '', icon: '' }),
      { name: 'Gym', parentId: null, kind: 'expense', icon: null },
    );
    assert.deepEqual(
      categoryInput({
        name: 'Bonos',
        kind: 'expense',
        parentId: 'Ingresos',
        icon: 'income',
      }),
      { name: 'Bonos', parentId: 'Ingresos', icon: 'income' },
    );
  });
});

describe('category pickers by kind', () => {
  const picker = CATEGORIES.map(({ id, name, parentId, key, kind }) => ({
    id,
    name,
    parentId,
    key,
    kind,
  }));

  it('offers spending categories for an expense and income ones for an income', () => {
    const expense = categoryOptions(picker, 'expense', 'es').map(
      (o) => o.value,
    );
    assert.ok(expense.includes('Supermercado'));
    assert.ok(!expense.includes('Sueldo'));
    const income = categoryOptions(picker, 'income', 'es').map((o) => o.value);
    assert.deepEqual(income, ['Ingresos', 'Sueldo']);
  });

  it('offers both (income last) when the movements are mixed', () => {
    const any = categoryOptions(picker, 'any', 'es').map((o) => o.value);
    assert.equal(any.at(-1), 'Sueldo');
    assert.ok(any.includes('Renta'));
  });
});
