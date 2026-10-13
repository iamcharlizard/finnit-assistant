import { normalizeLocale, resolveLocale } from './locale';

describe('resolveLocale', () => {
  it('prefers a supported x-locale header', () => {
    expect(
      resolveLocale({ headers: { 'x-locale': 'en' }, user: { locale: 'es' } }),
    ).toBe('en');
    expect(resolveLocale({ headers: { 'x-locale': 'es-MX' } })).toBe('es');
  });

  it("falls back to the user's locale, then Spanish", () => {
    expect(
      resolveLocale({ headers: { 'x-locale': 'fr' }, user: { locale: 'en' } }),
    ).toBe('en');
    expect(resolveLocale({ headers: {}, user: null })).toBe('es');
    expect(resolveLocale(undefined)).toBe('es');
  });

  it('normalizes or rejects values', () => {
    expect(normalizeLocale(' EN ')).toBe('en');
    expect(normalizeLocale('pt-BR')).toBeUndefined();
    expect(normalizeLocale(3)).toBeUndefined();
  });
});
