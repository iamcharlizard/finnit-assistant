import { ReceiptConfidence, ReceiptRoute } from '@finnit/database';
import {
  extractReceipt,
  findAmounts,
  findCardLast4,
  findDate,
  findHeaderName,
  findTaxId,
  findTotals,
  normalizeTaxId,
  parseCfdiQr,
  receiptConfidence,
} from './receipt-rules';

// Every fixture below is synthetic: invented stores, amounts and folios.
const today = new Date('2026-10-13T00:00:00.000Z');
const UUID = 'A1B2C3D4-1111-4222-8333-123456789ABC';
const qrUrl = (params: string) =>
  `https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?${params}`;

describe('parseCfdiQr', () => {
  it('reads a CFDI 4.0 QR', () => {
    expect(
      parseCfdiQr(
        qrUrl(
          `id=${UUID.toLowerCase()}&re=CCO8605231N4&rr=XAXX010101000&tt=245.50&fe=AbC1+2/=`,
        ),
      ),
    ).toEqual({
      uuid: UUID,
      issuerTaxId: 'CCO8605231N4',
      receiverTaxId: 'XAXX010101000',
      total: 245.5,
      sealTail: 'AbC1+2/=',
    });
  });

  it('reads the older format with a zero-padded total and &amp;', () => {
    const qr = parseCfdiQr(
      `?re=DEMO010203AB1&amp;rr=PEGJ800101AB2&amp;tt=0000001234.560000&amp;id=${UUID}`,
    );
    expect(qr).toMatchObject({
      issuerTaxId: 'DEMO010203AB1',
      receiverTaxId: 'PEGJ800101AB2',
      total: 1234.56,
      uuid: UUID,
    });
    expect(qr?.sealTail).toBeUndefined();
  });

  it.each([
    ['not a url', 'hello'],
    ['missing uuid', qrUrl('re=CCO8605231N4&tt=10.00')],
    ['bad uuid', qrUrl('id=123&re=CCO8605231N4&tt=10.00')],
    ['bad rfc', qrUrl(`id=${UUID}&re=HELLO&tt=10.00`)],
    ['bad total', qrUrl(`id=${UUID}&re=CCO8605231N4&tt=abc`)],
  ])('rejects %s', (_, text) => {
    expect(parseCfdiQr(text)).toBeNull();
  });
});

describe('findAmounts', () => {
  it.each([
    ['TOTAL $1,234.56', [1234.56]],
    ['TOTAL 1234.56', [1234.56]],
    ['TOTAL $ 99.90', [99.9]],
    ['TOTAL 120,00', [120]],
    ['TOTAL 1 234.50', [1234.5]],
    ['GRAN TOTAL 2.708.20', [2708.2]],
    ['2 X 15.50 31.00', [15.5, 31]],
    ['IVA 16% 16.00', [16]],
    ['ARTICULOS 5', []],
    ['FOLIO 000123', []],
  ])('%s', (line, expected) => {
    expect(findAmounts(line)).toEqual(expected);
  });
});

describe('findTotals', () => {
  it('takes the total line and ignores cash, change and savings', () => {
    const result = findTotals([
      'LECHE 1L 28.50',
      'PAN 45.00',
      'SUBTOTAL 63.36',
      'IVA 16% 10.14',
      'TOTAL A PAGAR $73.50',
      'EFECTIVO $500.00',
      'SU CAMBIO $426.50',
      'TOTAL AHORRO 12.00',
      'TOTAL DE ARTICULOS 2',
    ]);
    expect(result).toEqual({
      total: 73.5,
      subtotal: 63.36,
      tax: 10.14,
      totalLabelFound: true,
      subtotalTaxMatches: true,
    });
  });

  it('reads an amount the OCR split onto the next line', () => {
    const result = findTotals([
      'TOTAL',
      '$ 245.50',
      'PAGO CON TARJETA',
      '245.50',
    ]);
    expect(result.total).toBe(245.5);
  });

  it('does not take the next line when it is another labelled amount', () => {
    expect(findTotals(['TOTAL', 'EFECTIVO 500.00']).total).toBeUndefined();
  });

  it('picks the largest of several total lines (e.g. before/after discount)', () => {
    expect(findTotals(['TOTAL 90.00', 'TOTAL M.N. 100.00']).total).toBe(100);
  });

  it('accepts tax-included receipts (SUBTOTAL = TOTAL)', () => {
    const result = findTotals([
      'SUBTOTAL 116.00',
      'IVA INCLUIDO 16.00',
      'TOTAL 116.00',
    ]);
    expect(result.subtotalTaxMatches).toBe(true);
  });

  it('flags totals that do not add up', () => {
    const result = findTotals(['SUBTOTAL 100.00', 'IVA 16.00', 'TOTAL 150.00']);
    expect(result.subtotalTaxMatches).toBe(false);
  });

  it('ignores amounts left of the label (another column)', () => {
    const result = findTotals([
      '15.00 Articulo(s) Gran Total 2.708.20',
      'IVA 373.55',
      'Usted ahorro: 160.80',
      'Cuenta No. 0000 2.708.20',
    ]);
    expect(result.total).toBe(2708.2);
    expect(findTotals(['TOTAL ARTICULO(S) 15.00']).total).toBeUndefined();
    expect(findTotals(['TOTAL DE PAGOS 99.00']).total).toBeUndefined();
  });

  it('reads "Importe" as the subtotal of small shops', () => {
    const result = findTotals([
      'Importe',
      '86.21',
      'I.V.A.',
      '13.79',
      'TOTAL',
      '100.00',
    ]);
    expect(result).toMatchObject({
      subtotal: 86.21,
      tax: 13.79,
      total: 100,
      subtotalTaxMatches: true,
    });
  });

  it('tolerates OCR misreads of the label (T0TAL)', () => {
    expect(findTotals(['T0TAL 58.00']).total).toBe(58);
  });

  it('sums IVA and IEPS', () => {
    const result = findTotals([
      'SUBTOTAL 80.00',
      'IVA 12.80',
      'IEPS 7.20',
      'IMPORTE TOTAL 100.00',
    ]);
    expect(result.tax).toBe(20);
    expect(result.subtotalTaxMatches).toBe(true);
  });
});

describe('findDate', () => {
  it.each([
    ['FECHA: 13/10/2026 14:22', '2026-10-13'],
    ['12-10-26 09:15', '2026-10-12'],
    ['01/OCT/2026', '2026-10-01'],
    ['05-SEPT-2026', '2026-09-05'],
    ['3 DE OCTUBRE DE 2026', '2026-10-03'],
    ['2026-09-30 18:00:01', '2026-09-30'],
    ['10.10.2026', '2026-10-10'],
    ['09/25/2026', '2026-09-25'], // only valid month-first
  ])('%s', (line, expected) => {
    expect(findDate([line], today)).toBe(expected);
  });

  it('never returns a future or too old date', () => {
    expect(findDate(['14/10/2026'], today)).toBeUndefined();
    expect(findDate(['01/01/2020'], today)).toBeUndefined();
  });

  it('prefers the date on a FECHA line', () => {
    expect(findDate(['VIGENCIA 01/10/2026', 'FECHA 11/10/2026'], today)).toBe(
      '2026-10-11',
    );
  });

  it('day-first wins when both readings are valid', () => {
    expect(findDate(['05/10/2026'], today)).toBe('2026-10-05');
  });
});

describe('tax IDs', () => {
  it.each([
    ['CCO8605231N4', 'CCO8605231N4'],
    ['PEGJ800101AB2', 'PEGJ800101AB2'],
    ['CC08605231N4', 'CCO8605231N4'], // 0 read in the letters
    ['CCO86O5231N4', 'CCO8605231N4'], // O read in the digits
    ['CCO-860523-1N4', 'CCO8605231N4'],
    ['DEM1800101AB2', 'DEMI800101AB2'], // I read as 1 in a 4-letter RFC
    ['CCO8613231N4', null], // month 13
    ['TOOLONG8605231N4', null],
  ])('normalizeTaxId(%s)', (raw, expected) => {
    expect(normalizeTaxId(raw)).toBe(expected);
  });

  it('finds the merchant RFC and skips the generic public one', () => {
    expect(
      findTaxId(['TIENDA DEMO', 'R.F.C. XAXX010101000', 'RFC: DEM0101012X3']),
    ).toBe('DEM0101012X3');
  });
});

describe('findCardLast4', () => {
  it.each([
    [['VISA ************4321'], '4321'],
    [['TARJ: XXXX XXXX XXXX 9876'], '9876'],
    [['PAGO CON TARJETA TERMINACION 5555'], '5555'],
    [['MASTERCARD DEBITO 1212'], '1212'],
    [['TARJETA 2026'], undefined],
    [['TOTAL 1234.00'], undefined],
  ])('%j', (lines, expected) => {
    expect(findCardLast4(lines)).toBe(expected);
  });
});

describe('findHeaderName', () => {
  it('skips noise and strips the legal suffix', () => {
    expect(
      findHeaderName([
        '*** BIENVENIDO ***',
        'CAFETERIA LA DEMO S.A. DE C.V.',
        'AV. SIEMPRE VIVA 123',
      ]),
    ).toBe('CAFETERIA LA DEMO');
  });

  it('cuts the legal entity and what follows, skips branch codes', () => {
    expect(
      findHeaderName([
        'CENTRO E01234',
        'GASOLINERA DEMO S.A.DE C.V. SUCURSAL',
        'CALLE 1',
      ]),
    ).toBe('GASOLINERA DEMO');
  });

  it('ignores lines that are mostly numbers or dates', () => {
    expect(findHeaderName(['13/10/2026', '000123', 'PANADERIA ROSA'])).toBe(
      'PANADERIA ROSA',
    );
  });
});

describe('receiptConfidence', () => {
  const checks = { subtotalTaxMatches: false, qrTotalMatches: null };
  it('is low without total or date', () => {
    expect(receiptConfidence({ total: 10, checks })).toBe(
      ReceiptConfidence.low,
    );
    expect(receiptConfidence({ date: '2026-10-01', checks })).toBe(
      ReceiptConfidence.low,
    );
  });
  it('is medium with total and date, high when cross-checked', () => {
    expect(receiptConfidence({ total: 10, date: '2026-10-01', checks })).toBe(
      ReceiptConfidence.medium,
    );
    expect(
      receiptConfidence({
        total: 10,
        date: '2026-10-01',
        checks: { ...checks, subtotalTaxMatches: true },
      }),
    ).toBe(ReceiptConfidence.high);
  });
});

describe('extractReceipt', () => {
  it('convenience store receipt: chain, RFC from the table, high confidence', () => {
    const result = extractReceipt({
      today,
      knownTaxIds: new Map([['CCO8605231N4', 'OXXO']]),
      lines: [
        'CADENA COMERCIAL DEMO SA DE CV',
        'RFC CCO8605231N4',
        'SUC. CENTRO',
        '11/10/2026 21:05',
        'AGUA 1L 18.00',
        'GALLETAS 22.00',
        'SUBTOTAL 34.48',
        'IVA 5.52',
        'TOTAL',
        '$40.00',
        'EFECTIVO 50.00',
        'CAMBIO 10.00',
      ],
    });
    expect(result).toMatchObject({
      route: ReceiptRoute.ocr_rules,
      confidence: ReceiptConfidence.high,
      total: 40,
      subtotal: 34.48,
      tax: 5.52,
      date: '2026-10-11',
      merchantName: 'OXXO',
      merchantTaxId: 'CCO8605231N4',
    });
    expect(result.cfdi).toBeUndefined();
    expect(result.checks.qrTotalMatches).toBeNull();
  });

  it('restaurant receipt without cross-check: header name, card, medium', () => {
    const result = extractReceipt({
      today,
      lines: [
        'TACOS EL DEMO',
        'MESA 4  MESERO 2',
        '2026-10-12 22:10',
        '4 TACOS 120.00',
        '2 REFRESCOS 60.00',
        'TOTAL 180.00',
        'PROPINA 27.00',
        'VISA **** 4321',
      ],
    });
    expect(result).toMatchObject({
      confidence: ReceiptConfidence.medium,
      total: 180,
      date: '2026-10-12',
      merchantName: 'TACOS EL DEMO',
      cardLast4: '4321',
    });
    expect(result.merchantTaxId).toBeUndefined();
  });

  it('CFDI QR: exact total and RFC, high with a date', () => {
    const result = extractReceipt({
      today,
      codes: [
        qrUrl(
          `id=${UUID}&re=NWM9709244W4&rr=XAXX010101000&tt=512.30&fe=12345678`,
        ),
      ],
      lines: ['WAL MART SUPERCENTER', 'FECHA 10/10/2026', 'TOTAL 512.30'],
    });
    expect(result).toMatchObject({
      route: ReceiptRoute.cfdi_qr,
      confidence: ReceiptConfidence.high,
      total: 512.3,
      merchantTaxId: 'NWM9709244W4',
      merchantName: 'Walmart',
      checks: { qrTotalMatches: true },
    });
    expect(result.cfdi?.uuid).toBe(UUID);
  });

  it('QR total wins over a misread OCR total', () => {
    const result = extractReceipt({
      today,
      codes: [qrUrl(`id=${UUID}&re=CCO8605231N4&tt=88.00`)],
      lines: ['TIENDA DEMO', '13/10/2026', 'TOTAL 38.00'],
    });
    expect(result.total).toBe(88);
    expect(result.checks.qrTotalMatches).toBe(false);
  });

  it('low confidence when the total is missing', () => {
    const result = extractReceipt({
      today,
      lines: ['PAPELERIA DEMO', '13/10/2026', 'LAPIZ 12.00'],
    });
    expect(result.total).toBeUndefined();
    expect(result.confidence).toBe(ReceiptConfidence.low);
  });

  it('ignores invalid QR codes (e.g. a store promo link)', () => {
    const result = extractReceipt({
      today,
      codes: ['https://promo.example.test/?id=1'],
      lines: ['TIENDA DEMO', '13/10/2026', 'TOTAL 10.00'],
    });
    expect(result.route).toBe(ReceiptRoute.ocr_rules);
  });
});
