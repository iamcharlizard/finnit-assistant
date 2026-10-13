import { ImportedLineKind } from '@finnit/database';
import { BanamexCreditCardParser } from './banamex-credit-card.parser';
import { checkStatement } from './statement-validation';

// Synthetic statement with the layout of a real Banamex statement as
// extracted by pdf.js (fake names, card numbers and movements). Real
// statements must never be committed: test/fixtures/private/ is git-ignored.
const STATEMENT = `..
JUANA EJEMPLO PRUEBA
C FALSA 123
Estado de Cuenta Mensual
Tarjeta de Crédito
EXPLORA BANAMEX
Página 1 de 4
TU PAGO REQUERIDO ESTE PERIODO
Periodo: 19-ago-2026 al 18-sep-2026
Fecha de corte: 18-sep-2026
Número de días en el periodo: 31 días
Fecha límite de pago:1 jueves, 8-oct-2026
Pago para no generar intereses:2 $1,650.00
Pago mínimo + compras y cargos diferidos a meses: 3 $1,900.00
Pago mínimo:4 $300.00
Tarjeta de Crédito EXPLORA BANAMEX
Número de tarjeta 4000 1234 5678 9012
El pago mínimo $300.00 11 meses $1,000.00
RESUMEN DE CARGOS Y ABONOS DEL PERIODO
Adeudo del periodo anterior = $2,000.00
Cargos regulares (no a meses) + $2,397.00
Cargos compras a meses (capital)7 + $1,000.00
Pagos y abonos - $3,747.00
MENSAJES IMPORTANTES NIVEL DE USO DE TU TARJETA
Saldo cargos regulares: $ 1,650.00
Saldo cargos a meses: $ 9,000.00
Saldo deudor total:11 $ 10,650.00
=== page break ===
Página 2 de 4
Número de tarjeta: 4000123456789012
DESGLOSE DE MOVIMIENTOS14
COMPRAS Y CARGOS DIFERIDOS A MESES SIN INTERESES
Tarjeta titular: 40001234 56789012 JUANA EJEMPLO PRUEBA
Fecha
de la
operación
Descripción Monto
Original
19-ago-2026 TIENDA A MESES TAM 010101AB1MX $12,000.00 $9,000.00 $1,000.00 3 de 12 NA
CARGOS, ABONOS Y COMPRAS REGULARES (NO A MESES)
Tarjeta titular: 40001234 56789012 JUANA EJEMPLO PRUEBA
Fecha de la
operación
Fecha
de cargo Descripción del movimiento Monto
19-ago-2026 19-ago-2026 TIENDA A MESES 003 de 012 + $1,000.00
20-ago-2026 21-ago-2026 NETFLIX COM 1 NME 110513PI3 + $299.00
22-ago-2026 24-ago-2026 SUPERMERCADO CENTRO SUP 9709244W4 + $1,250.50
02-sep-2026 02-sep-2026 SU ABONO...GRACIAS - $3,500.00
=== page break ===
Página 3 de 4
Número de tarjeta: 4000123456789012
CARGOS, ABONOS Y COMPRAS REGULARES (NO A MESES)
Tarjeta titular: 40001234 56789012 JUANA EJEMPLO PRUEBA
Fecha de la
operación
Fecha
de cargo Descripción del movimiento Monto
05-sep-2026 07-sep-2026 LIBRERIA LUNA LLU 0304101S1MX + $147.50
CARGOS, ABONOS Y COMPRAS REGULARES (NO A MESES)
Tarjeta digital: 40001234 99990000 JUANA EJEMPLO PRUEBA
Fecha de la
operación
Fecha
de cargo Descripción del movimiento Monto
06-sep-2026 07-sep-2026 STREAMING EXTRANJERO LONDON GB + $500.00
TC1* 17.042700 TC2* 1.158650 EURO 25.30
08-sep-2026 09-sep-2026 TIENDA EN LINEA TEL 140618P37MX - $247.00
12-sep-2026 14-sep-2026 COMISION ANUALIDAD + $200.00
=== page break ===
Página 4 de 4
Total cargos + $3,397.00
Total abonos - $3,747.00
ATENCIÓN DE QUEJAS
19-ago-2026 19-ago-2026 NO ES UN MOVIMIENTO + $999.00
`;

describe('BanamexCreditCardParser', () => {
  const parser = new BanamexCreditCardParser();

  it('recognizes Banamex statements only', () => {
    expect(parser.canParse(STATEMENT)).toBe(true);
    expect(parser.canParse('ESTADO DE CUENTA BBVA')).toBe(false);
  });

  it('reads the period, dates and totals', async () => {
    const result = await parser.parse({ text: STATEMENT });
    expect(result).toEqual(
      expect.objectContaining({
        currency: 'MXN',
        cardLast4: '9012',
        periodStart: '2026-08-19',
        periodEnd: '2026-09-18',
        statementDate: '2026-09-18',
        paymentDueDate: '2026-10-08',
        previousBalance: 2000,
        totalCharges: 3397,
        totalCredits: 3747,
        statementBalance: 1650,
        noInterestPayment: 1650,
        minimumPayment: 300,
      }),
    );
  });

  it('reads the movements of every card and skips plan summaries', async () => {
    const { lines } = await parser.parse({ text: STATEMENT });
    expect(lines.map((l) => [l.date, l.merchant, l.amount, l.kind])).toEqual([
      ['2026-08-19', 'TIENDA A MESES', 1000, ImportedLineKind.installment],
      ['2026-08-20', 'NETFLIX COM 1', 299, ImportedLineKind.charge],
      ['2026-08-22', 'SUPERMERCADO CENTRO', 1250.5, ImportedLineKind.charge],
      ['2026-09-02', 'SU ABONO...GRACIAS', 3500, ImportedLineKind.payment],
      ['2026-09-05', 'LIBRERIA LUNA', 147.5, ImportedLineKind.charge],
      [
        '2026-09-06',
        'STREAMING EXTRANJERO LONDON GB',
        500,
        ImportedLineKind.charge,
      ],
      ['2026-09-08', 'TIENDA EN LINEA', 247, ImportedLineKind.refund],
      ['2026-09-12', 'COMISION ANUALIDAD', 200, ImportedLineKind.fee],
    ]);
  });

  it('keeps the full description, posting date and installment numbers', async () => {
    const { lines } = await parser.parse({ text: STATEMENT });
    expect(lines[0]).toEqual({
      date: '2026-08-19',
      postDate: '2026-08-19',
      description: 'TIENDA A MESES 003 de 012',
      merchant: 'TIENDA A MESES',
      amount: 1000,
      kind: ImportedLineKind.installment,
      installmentNumber: 3,
      installmentTotal: 12,
    });
    expect(lines[1].description).toBe('NETFLIX COM 1 NME 110513PI3');
    expect(lines[1].postDate).toBe('2026-08-21');
  });

  it('produces a statement whose movements explain the balance', async () => {
    const result = await parser.parse({ text: STATEMENT });
    expect(checkStatement(result)).toEqual({
      linesNet: -350,
      computedTotal: 1650,
      difference: 0,
      balanced: true,
    });
  });

  it('fails without a cut-off date', async () => {
    await expect(
      parser.parse({ text: STATEMENT.replace(/Fecha de corte: .*\n/, '') }),
    ).rejects.toThrow('cut-off date');
  });
});
