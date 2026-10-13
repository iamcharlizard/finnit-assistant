import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import en from '@/messages/en.json';
import es from '@/messages/es.json';
import { negotiateLocale, resolveLocale } from './locales';
import { testLocalizer } from './testing';

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out.set(path, value);
    else for (const [k, v] of flatten(value, path)) out.set(k, v);
  }
  return out;
}

/** Argument names of an ICU message ("{count, plural, …}" → count). */
function argumentsOf(message: string): string[] {
  const names = new Set<string>();
  for (const match of message.matchAll(/\{\s*([A-Za-z_]\w*)\s*[,}]/g)) {
    names.add(match[1]!);
  }
  for (const match of message.matchAll(/<(\w+)>/g)) names.add(`<${match[1]}>`);
  return [...names].sort();
}

describe('messages', () => {
  const esKeys = flatten(es as Tree);
  const enKeys = flatten(en as Tree);

  it('has the same keys in Spanish and English', () => {
    assert.deepEqual([...enKeys.keys()].sort(), [...esKeys.keys()].sort());
  });

  it('uses the same arguments in both languages', () => {
    for (const [key, message] of esKeys) {
      assert.deepEqual(
        argumentsOf(enKeys.get(key) ?? ''),
        argumentsOf(message),
        key,
      );
    }
  });

  it('formats plurals', () => {
    assert.equal(
      testLocalizer('es').t('cards.count', { count: 1 }),
      '1 tarjeta',
    );
    assert.equal(
      testLocalizer('en').t('history.count', { shown: '30', total: 31 }),
      '30 of 31 transactions',
    );
  });
});

describe('locale resolution', () => {
  it('reads Accept-Language by quality', () => {
    assert.equal(negotiateLocale('en-US,en;q=0.9,es;q=0.8'), 'en');
    assert.equal(negotiateLocale('fr-FR, es-MX;q=0.7, en;q=0.5'), 'es');
    assert.equal(negotiateLocale('es;q=0.2, en;q=0.9'), 'en');
    assert.equal(negotiateLocale('fr, de'), null);
    assert.equal(negotiateLocale('en;q=0'), null);
    assert.equal(negotiateLocale(null), null);
  });

  it('prefers the user, then the cookie, then the browser (signed out)', () => {
    const header = 'en-US,en;q=0.9';
    assert.equal(
      resolveLocale({
        userLocale: 'en',
        cookieLocale: 'es',
        acceptLanguage: null,
        signedIn: true,
      }),
      'en',
    );
    assert.equal(
      resolveLocale({
        userLocale: null,
        cookieLocale: 'en',
        acceptLanguage: null,
        signedIn: true,
      }),
      'en',
    );
    // Signed in without a preference: Spanish, not the browser's language.
    assert.equal(
      resolveLocale({ acceptLanguage: header, signedIn: true }),
      'es',
    );
    assert.equal(
      resolveLocale({ acceptLanguage: header, signedIn: false }),
      'en',
    );
    assert.equal(
      resolveLocale({
        userLocale: 'fr',
        cookieLocale: 'xx',
        acceptLanguage: 'de',
        signedIn: false,
      }),
      'es',
    );
  });
});
