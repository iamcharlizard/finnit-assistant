import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { GraphqlRequestError } from '@finnit/core/graphql/request';
import { testLocalizer } from '@finnit/core/i18n/testing';
import {
  CREATE_ALIAS_MUTATION,
  UPDATE_ALIAS_MUTATION,
  aliasErrorMessage,
  regexErrorOf,
  saveAlias,
  setAliasActive,
} from './api';
import {
  PATTERN_MAX,
  PREVIEW_DEBOUNCE_MS,
  buildAliasInput,
  formOfAlias,
  hasErrors,
  isValidRegex,
  newAliasForm,
  previewInput,
  previewKey,
  validateAliasForm,
  withActive,
} from '@finnit/core/aliases/form';
import type { ApiMerchantAlias } from '@finnit/core/aliases/types';

const alias: ApiMerchantAlias = {
  id: 'al1',
  matchType: 'starts_with',
  pattern: 'CLIP MX*TACOS',
  displayName: 'Tacos Don Güero',
  category: { id: 'food', name: 'Comida', parentId: null },
  isPrivate: false,
  isProtected: false,
  locked: false,
  priority: 5,
  active: true,
  transferAccountId: null,
  matchCount: 3,
  createdAt: '2026-10-12T00:00:00.000Z',
};

describe('alias form', () => {
  it('requires a pattern and a name', () => {
    const errors = validateAliasForm(newAliasForm());
    assert.deepEqual(errors, {
      pattern: 'patternRequired',
      displayName: 'displayNameRequired',
    });
    assert.ok(hasErrors(errors));
    assert.ok(
      !hasErrors(
        validateAliasForm(
          newAliasForm({ pattern: 'uber', displayName: 'Uber' }),
        ),
      ),
    );
  });

  it('limits the pattern to 200 characters and the name to 80', () => {
    const errors = validateAliasForm(
      newAliasForm({
        pattern: 'a'.repeat(PATTERN_MAX + 1),
        displayName: 'b'.repeat(81),
      }),
    );
    assert.equal(errors.pattern, 'patternTooLong');
    assert.equal(errors.displayName, 'displayNameTooLong');
    assert.equal(
      validateAliasForm(
        newAliasForm({ pattern: 'a'.repeat(PATTERN_MAX), displayName: 'x' }),
      ).pattern,
      undefined,
    );
    // Spaces around the pattern don't count.
    assert.equal(
      validateAliasForm(
        newAliasForm({
          pattern: ` ${'a'.repeat(PATTERN_MAX)} `,
          displayName: 'x',
        }),
      ).pattern,
      undefined,
    );
  });

  it('checks regular expressions only in regex mode', () => {
    assert.ok(isValidRegex('^oxxo (gas|tienda)'));
    assert.ok(!isValidRegex('(unclosed'));
    assert.equal(
      validateAliasForm(
        newAliasForm({
          matchType: 'regex',
          pattern: '(unclosed',
          displayName: 'x',
        }),
      ).pattern,
      'invalidRegex',
    );
    assert.equal(
      validateAliasForm(
        newAliasForm({
          matchType: 'contains',
          pattern: '(unclosed',
          displayName: 'x',
        }),
      ).pattern,
      undefined,
    );
  });

  it('accepts whole priorities between -1000 and 1000', () => {
    const at = (priority: string) =>
      validateAliasForm(
        newAliasForm({ pattern: 'a', displayName: 'b', priority }),
      ).priority;
    assert.equal(at('0'), undefined);
    assert.equal(at(' 1000 '), undefined);
    assert.equal(at('1001'), 'priority');
    assert.equal(at('-1000'), undefined);
    assert.equal(at('-1001'), 'priority');
    assert.equal(at('1.5'), 'priority');
    assert.equal(at(''), 'priority');
  });

  it('builds the input, trimmed, and round-trips an alias', () => {
    assert.deepEqual(
      buildAliasInput(
        newAliasForm({
          matchType: 'exact',
          pattern: '  netflix.com ',
          displayName: ' Netflix ',
          isPrivate: true,
          priority: '10',
        }),
      ),
      {
        matchType: 'exact',
        pattern: 'netflix.com',
        displayName: 'Netflix',
        categoryId: null,
        isPrivate: true,
        priority: 10,
        active: true,
        transferAccountId: null,
        isProtected: false,
      },
    );
    assert.deepEqual(buildAliasInput(formOfAlias(alias)), {
      matchType: 'starts_with',
      pattern: 'CLIP MX*TACOS',
      displayName: 'Tacos Don Güero',
      categoryId: 'food',
      isPrivate: false,
      priority: 5,
      active: true,
      transferAccountId: null,
      isProtected: false,
    });
    assert.deepEqual(withActive(alias, false), {
      ...buildAliasInput(formOfAlias(alias)),
      active: false,
    });
  });
});

describe('alias preview', () => {
  it('waits for a usable pattern', () => {
    assert.equal(previewInput({ matchType: 'contains', pattern: '  ' }), null);
    assert.equal(previewInput({ matchType: 'regex', pattern: '[a-' }), null);
    assert.equal(
      previewInput({ matchType: 'contains', pattern: 'x'.repeat(201) }),
      null,
    );
    assert.deepEqual(
      previewInput({ matchType: 'contains', pattern: ' Uber ' }),
      {
        matchType: 'contains',
        pattern: 'Uber',
        displayName: 'Uber',
        categoryId: null,
        isPrivate: false,
        priority: 0,
        active: true,
        transferAccountId: null,
        isProtected: false,
      },
    );
  });

  it('asks again only when the match changes, after a pause', () => {
    const a = previewInput({ matchType: 'contains', pattern: 'uber' });
    const b = previewInput({ matchType: 'contains', pattern: ' uber' });
    const c = previewInput({ matchType: 'starts_with', pattern: 'uber' });
    assert.equal(previewKey(a), previewKey(b));
    assert.notEqual(previewKey(a), previewKey(c));
    assert.equal(previewKey(null), null);
    assert.ok(PREVIEW_DEBOUNCE_MS >= 250 && PREVIEW_DEBOUNCE_MS <= 800);
  });
});

describe('alias api', () => {
  it('creates without an id and updates with one', async () => {
    const calls: { query: string; variables?: Record<string, unknown> }[] = [];
    const run = async <T>(
      query: string,
      variables?: Record<string, unknown>,
    ) => {
      calls.push({ query, variables });
      return { createMerchantAlias: alias, updateMerchantAlias: alias } as T;
    };
    const form = newAliasForm({ pattern: 'uber', displayName: 'Uber' });
    await saveAlias(form, null, run);
    await saveAlias(form, 'al1', run);
    await setAliasActive(alias, false, run);
    assert.equal(calls[0]!.query, CREATE_ALIAS_MUTATION);
    assert.equal(calls[0]!.variables!.id, undefined);
    assert.equal(calls[1]!.query, UPDATE_ALIAS_MUTATION);
    assert.equal(calls[1]!.variables!.id, 'al1');
    assert.equal(
      (calls[2]!.variables!.input as { active: boolean }).active,
      false,
    );
  });

  it('puts regex errors under the field and translates the rest', () => {
    const t = testLocalizer('es').t;
    const regex = new GraphqlRequestError(
      'Invalid regular expression: missing )',
      'BAD_REQUEST',
      true,
    );
    assert.equal(regexErrorOf(regex), 'Invalid regular expression: missing )');
    assert.equal(regexErrorOf(new Error('Category not found')), null);
    assert.equal(
      aliasErrorMessage(
        new GraphqlRequestError('Alias not found', 'NOT_FOUND', true),
        t,
      ),
      'Ese nombre automático ya no existe.',
    );
  });

  it("keeps a rule's transfer account when it is edited or switched off", () => {
    const transfer = { ...alias, transferAccountId: 'acc-nu' };
    assert.equal(
      buildAliasInput(formOfAlias(transfer)).transferAccountId,
      'acc-nu',
    );
    assert.equal(withActive(transfer, false).transferAccountId, 'acc-nu');
  });

  it('makes a protected rule private, and starts a new one from given values', () => {
    const form = newAliasForm({
      pattern: 'KSK*VID ONLYFANSFPA',
      displayName: 'Suscripción digital',
      isProtected: true,
    });
    assert.equal(form.matchType, 'contains');
    const input = buildAliasInput(form);
    assert.equal(input.isProtected, true);
    assert.equal(input.isPrivate, true);
  });

  it('a locked rule has no pattern to fill the form with', () => {
    const locked = { ...alias, pattern: null, isProtected: true, locked: true };
    assert.equal(formOfAlias(locked).pattern, '');
  });
});
