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
      originalDescription: 'X',
      aliasId: 'alias-1',
      hasOwnAlias: false,
      categorySource: null,
      description: undefined,
      merchantName: 'X',
    });
  });
});
