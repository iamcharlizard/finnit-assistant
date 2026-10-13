import { ImportedLineKind } from '@finnit/database';
import { normalizeText, parseAmount, parseDate } from './parse-utils';
import { checkStatement } from './statement-validation';
import { ParsedStatement } from './parsed-statement';

describe('parse-utils', () => {
  it.each([
    ['$1,234.56', 1234.56],
    ['1 234.56', 1234.56],
    ['450', 450],
    ['-450.00', -450],
    ['450.00-', -450],
    ['(450.00)', -450],
    ['+12.5', 12.5],
    ['abc', null],
    ['1.234,56', null],
  ])('parseAmount(%p) = %p', (raw, expected) => {
    expect(parseAmount(raw)).toBe(expected);
  });

  it.each([
    ['15-ene-2026', '2026-01-15'],
    ['15 ENE 2026', '2026-01-15'],
    ['5-sept-25', '2025-09-05'],
    ['31/12/2025', '2025-12-31'],
    ['2026-02-28', '2026-02-28'],
    ['30-feb-2026', null],
    ['15-xyz-2026', null],
  ])('parseDate(%p) = %p', (raw, expected) => {
    expect(parseDate(raw)).toBe(expected);
  });

  it('completes dates without a year', () => {
    expect(parseDate('03-mar', 2026)).toBe('2026-03-03');
    expect(parseDate('03-mar')).toBeNull();
  });

  it('normalizes merchant text', () => {
    expect(normalizeText('  Café  Ñandú*Netflix.com ')).toBe(
      'CAFE NANDU NETFLIX COM',
    );
  });
});

describe('checkStatement', () => {
  const base: ParsedStatement = {
    currency: 'MXN',
    previousBalance: 1000,
    statementBalance: 1349,
    lines: [
      {
        date: '2026-09-10',
        description: 'NETFLIX',
        amount: 299,
        kind: ImportedLineKind.charge,
      },
      {
        date: '2026-09-12',
        description: 'MSI 2 DE 6',
        amount: 500,
        kind: ImportedLineKind.installment,
      },
      {
        date: '2026-09-15',
        description: 'PAGO',
        amount: 500,
        kind: ImportedLineKind.payment,
      },
      {
        date: '2026-09-20',
        description: 'COMISION',
        amount: 50,
        kind: ImportedLineKind.fee,
      },
    ],
  };

  it('is balanced when the lines explain the statement balance', () => {
    expect(checkStatement(base)).toEqual({
      linesNet: 349,
      computedTotal: 1349,
      difference: 0,
      balanced: true,
    });
  });

  it('reports the difference when a movement is missing', () => {
    const result = checkStatement({ ...base, statementBalance: 1549 });
    expect(result.difference).toBe(200);
    expect(result.balanced).toBe(false);
  });

  it('tolerates rounding up to one peso', () => {
    expect(checkStatement({ ...base, statementBalance: 1349.8 }).balanced).toBe(
      true,
    );
  });

  it('cannot check a statement without totals', () => {
    const result = checkStatement({ ...base, previousBalance: undefined });
    expect(result).toEqual({
      linesNet: 349,
      computedTotal: null,
      difference: null,
      balanced: false,
    });
  });
});
