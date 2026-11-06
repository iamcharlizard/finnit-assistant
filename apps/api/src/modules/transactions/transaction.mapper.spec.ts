import {
  PRIVATE_FALLBACK_NAME,
  presentTransaction,
  presentationFields,
} from './transaction.mapper';

const base = {
  merchantName: 'PAYPAL *FARMACIA 123',
  description: 'Compra tarjeta',
  aliasName: null,
  isPrivate: false,
  alias: null,
};

describe('presentTransaction', () => {
  it('without aliases shows merchantName, then description, then ""', () => {
    expect(presentTransaction(base).displayName).toBe('PAYPAL *FARMACIA 123');
    expect(
      presentTransaction({ ...base, merchantName: '  ' }).displayName,
    ).toBe('Compra tarjeta');
    expect(
      presentTransaction({ ...base, merchantName: null, description: null })
        .displayName,
    ).toBe('');
    expect(presentTransaction(base).originalDescription).toBe(
      'PAYPAL *FARMACIA 123',
    );
  });

  it('the one-off alias wins over the alias rule', () => {
    const shown = presentTransaction({
      ...base,
      aliasName: 'Medicinas',
      alias: { displayName: 'Farmacia', isPrivate: false },
    });
    expect(shown.displayName).toBe('Medicinas');
    expect(shown.hasOwnAlias).toBe(true);
  });

  it('uses the alias rule name when there is no one-off alias', () => {
    const shown = presentTransaction({
      ...base,
      alias: { displayName: 'Farmacia', isPrivate: false },
    });
    expect(shown.displayName).toBe('Farmacia');
    expect(shown.hasOwnAlias).toBe(false);
    expect(shown.isPrivate).toBe(false);
    expect(shown.originalDescription).toBe('PAYPAL *FARMACIA 123');
  });

  it('a private alias rule hides the original in lists', () => {
    const shown = presentTransaction({
      ...base,
      alias: { displayName: 'Regalo', isPrivate: true },
    });
    expect(shown).toEqual({
      displayName: 'Regalo',
      isPrivate: true,
      ownPrivate: false,
      originalLocked: false,
      aliasRule: null,
      hasOwnAlias: false,
      originalDescription: null,
      merchantName: null,
      description: null,
    });
  });

  it('a one-off private mark hides it too, and the detail reveals it', () => {
    const row = { ...base, aliasName: 'Sorpresa', isPrivate: true };
    expect(presentTransaction(row).originalDescription).toBeNull();
    const revealed = presentTransaction(row, true);
    expect(revealed.isPrivate).toBe(true);
    expect(revealed.originalDescription).toBe('PAYPAL *FARMACIA 123');
    expect(revealed.merchantName).toBe('PAYPAL *FARMACIA 123');
    expect(revealed.description).toBe('Compra tarjeta');
  });

  it('a private movement without any name never falls back to the original', () => {
    const shown = presentTransaction({ ...base, isPrivate: true });
    expect(shown.displayName).toBe(PRIVATE_FALLBACK_NAME);
  });
});

describe('protected rules (privacy PIN)', () => {
  const protectedAlias = {
    id: 'alias-1',
    displayName: 'Suscripción digital',
    isPrivate: false,
    isProtected: true,
    pattern: 'ONLYFANS',
  };

  it('are always private and keep the bank text and pattern behind the PIN', () => {
    const detail = presentTransaction({ ...base, alias: protectedAlias }, true);
    expect(detail.isPrivate).toBe(true);
    expect(detail.originalLocked).toBe(true);
    expect(detail.originalDescription).toBeNull();
    expect(detail.merchantName).toBeNull();
    expect(detail.aliasRule).toEqual({
      id: 'alias-1',
      displayName: 'Suscripción digital',
      isPrivate: true,
      isProtected: true,
      pattern: null,
    });
  });

  it('reveal both once unlocked', () => {
    const detail = presentTransaction(
      { ...base, alias: protectedAlias },
      true,
      true,
    );
    expect(detail.originalLocked).toBe(false);
    expect(detail.originalDescription).toBe('PAYPAL *FARMACIA 123');
    expect(detail.aliasRule?.pattern).toBe('ONLYFANS');
  });

  it('never reveal in lists, unlocked or not', () => {
    const list = presentTransaction(
      { ...base, alias: protectedAlias },
      false,
      true,
    );
    expect(list.originalDescription).toBeNull();
  });
});

describe('presentationFields', () => {
  it('works for rows that did not load the alias relation', () => {
    expect(
      presentationFields({
        merchantName: 'X',
        description: null,
        aliasId: 'alias-1',
      }),
    ).toEqual({
      displayName: 'X',
      isPrivate: false,
      ownPrivate: false,
      originalLocked: false,
      aliasRule: null,
      originalDescription: 'X',
      aliasId: 'alias-1',
      hasOwnAlias: false,
      categorySource: null,
      description: undefined,
      merchantName: 'X',
    });
  });
});
