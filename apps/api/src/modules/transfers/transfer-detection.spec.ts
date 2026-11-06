import { aliasPatternFor, looksLikeTransfer } from './transfer-detection';

describe('looksLikeTransfer', () => {
  it.each([
    'P INT 0311026 Transferencia interbancaria',
    'P TER 0000031126 JUAN PEREZ LOPEZ',
    'SPEI ENVIADO BBVA',
    'Traspaso a cuenta propia',
    'TRANSF. A TERCEROS',
    'Transferencia recibida',
  ])('reads "%s" as a transfer', (text) => {
    expect(looksLikeTransfer(text)).toBe(true);
  });

  it.each([
    'OXXO LOMA DORADA',
    'DIS.EFE.BANAMEX LOMA DORADA 2',
    'PAGO DE SERVICIO 571977 A TB 51889991',
    'APPLE.COM/BILL',
    'Transformadores del Norte',
  ])('does not read "%s" as a transfer', (text) => {
    expect(looksLikeTransfer(text)).toBe(false);
  });

  it('checks every text it gets and ignores empty ones', () => {
    expect(looksLikeTransfer(null, 'Amazon', 'SPEI recibido')).toBe(true);
    expect(looksLikeTransfer(undefined, '')).toBe(false);
  });
});

describe('aliasPatternFor', () => {
  it('keeps the longest run of words without digits', () => {
    expect(aliasPatternFor('P INT 0311026 Transferencia interbancaria')).toBe(
      'Transferencia interbancaria',
    );
    expect(aliasPatternFor('P TER 0000031126 JUAN PEREZ LOPEZ')).toBe(
      'JUAN PEREZ LOPEZ',
    );
  });

  it('returns an empty text when there is nothing to keep', () => {
    expect(aliasPatternFor('123 456')).toBe('');
    expect(aliasPatternFor(null)).toBe('');
  });
});
