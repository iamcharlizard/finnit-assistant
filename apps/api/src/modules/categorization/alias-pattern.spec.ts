import { AliasMatchType } from '@finnit/database';
import { heuristicPatterns, parseAiPattern } from './alias-pattern';

describe('heuristicPatterns', () => {
  it('keeps the digit-free words every example shares', () => {
    expect(
      heuristicPatterns([
        'KSK*VID ONLYFANSFPA 231020BF8MX',
        'KSK*VID ONLYFANSFPA 241105AA1MX',
      ])[0],
    ).toBe('KSK*VID ONLYFANSFPA');
    expect(
      heuristicPatterns([
        'SERVICIOS DIGITALES 1EME 1409305E4MX',
        'SERVICIOS DIGITALES 2XYZ 0911112A1MX',
      ])[0],
    ).toBe('SERVICIOS DIGITALES');
  });

  it("falls back to each example's own fragment when they share nothing", () => {
    expect(heuristicPatterns(['NETFLIX 123', 'SPOTIFY 456'])).toEqual([
      'NETFLIX',
      'SPOTIFY',
    ]);
  });

  it('ignores accents and case when comparing examples', () => {
    expect(heuristicPatterns(['Café Sirena 001', 'CAFE SIRENA 002'])[0]).toBe(
      'Café Sirena',
    );
  });
});

describe('parseAiPattern', () => {
  it('accepts a usable rule', () => {
    expect(
      parseAiPattern({
        matchType: 'contains',
        pattern: ' ONLYFANS ',
        explanation: 'Busca «ONLYFANS».',
      }),
    ).toEqual({
      matchType: AliasMatchType.contains,
      pattern: 'ONLYFANS',
      explanation: 'Busca «ONLYFANS».',
    });
  });

  it('refuses unsafe or useless rules', () => {
    expect(parseAiPattern({ matchType: 'exact', pattern: 'X' })).toBeNull();
    expect(
      parseAiPattern({ matchType: 'regex', pattern: '^(?=a).*' }),
    ).toBeNull();
    expect(
      parseAiPattern({ matchType: 'regex', pattern: '(a)\\1' }),
    ).toBeNull();
    expect(parseAiPattern({ matchType: 'contains', pattern: 'ab' })).toBeNull();
    expect(
      parseAiPattern({ matchType: 'contains', pattern: 'x'.repeat(201) }),
    ).toBeNull();
    expect(parseAiPattern(null)).toBeNull();
  });
});
