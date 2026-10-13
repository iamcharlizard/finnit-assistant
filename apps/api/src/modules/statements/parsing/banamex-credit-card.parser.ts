import { ImportedLineKind } from '@finnit/database';
import {
  ParsedStatement,
  ParsedStatementLine,
  StatementParseError,
  StatementParser,
} from './parsed-statement';
import { parseAmount, parseDate } from './parse-utils';

const DATE = String.raw`\d{1,2}-[a-zA-Z]{3}-\d{4}`;

/** "18-ago-2026 19-ago-2026 NETFLIX COM 1 NME 110513PI3 + $448.00" */
const MOVEMENT = new RegExp(
  String.raw`^(${DATE})\s+(${DATE})\s+(.+?)\s+([+-])\s*\$\s*([\d,]+\.\d{2})$`,
);
/** Monthly installment of a "meses sin intereses" plan: "AMAZON A MESES 007 de 012". */
const INSTALLMENT = /\s+(\d{1,3})\s+de\s+(\d{1,3})$/i;
/** Merchant tax id appended by the bank: "NME 110513PI3", "ANE 140618P37MX". */
const MERCHANT_RFC = /\s+[A-Z&Ñ]{3,4}\s?\d{6}[A-Z0-9]{2,3}(MX)?$/;

const REGULAR_SECTION = 'CARGOS, ABONOS Y COMPRAS REGULARES';

/**
 * Banamex credit card statement ("Estado de Cuenta Mensual, Tarjeta de
 * Crédito"), as extracted by pdf.js.
 *
 * Movements come from the "CARGOS, ABONOS Y COMPRAS REGULARES" tables of
 * every card on the account (holder and digital). They already include the
 * monthly installment of each "meses sin intereses" plan ("006 de 012"); the
 * "COMPRAS Y CARGOS DIFERIDOS A MESES" tables only summarize the plans and
 * are skipped.
 *
 * `statementBalance` is the regular balance ("Saldo cargos regulares", the
 * same as "Pago para no generar intereses"): previous balance + charges −
 * credits. "Saldo deudor total" also includes what is left of the plans, so
 * it cannot be checked against the period's movements.
 */
export class BanamexCreditCardParser implements StatementParser {
  readonly id = 'banamex_v1';

  canParse(text: string): boolean {
    return (
      /BANAMEX/i.test(text) &&
      text.includes(REGULAR_SECTION) &&
      /Fecha de corte/i.test(text)
    );
  }

  parse({ text }: { text: string }): Promise<ParsedStatement> {
    const lines = text
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    const period = this.match(
      text,
      new RegExp(String.raw`Periodo:\s*(${DATE})\s+al\s+(${DATE})`, 'i'),
    );
    const statementDate = this.date(
      this.match(
        text,
        new RegExp(String.raw`Fecha de corte:\s*(${DATE})`, 'i'),
      )?.[1],
    );
    const paymentDueDate = this.date(
      this.match(
        text,
        new RegExp(String.raw`Fecha l[ií]mite de pago:[^\n]*?(${DATE})`, 'i'),
      )?.[1],
    );
    if (!statementDate) {
      return Promise.reject(
        new StatementParseError('Banamex statement without a cut-off date'),
      );
    }

    const noInterestPayment = this.amountAfter(
      text,
      /Pago para no generar intereses:\s*\d*\s*\$\s*([\d,]+\.\d{2})/i,
    );
    const regularBalance = this.amountAfter(
      text,
      /Saldo cargos regulares:\s*\$\s*([\d,]+\.\d{2})/i,
    );
    const cardNumber = this.match(
      text,
      /N[uú]mero de tarjeta:?\s*((?:\d[\s]?){15,16})/i,
    )?.[1].replace(/\D/g, '');

    return Promise.resolve({
      currency: 'MXN',
      cardLast4: cardNumber ? cardNumber.slice(-4) : undefined,
      periodStart: this.date(period?.[1]),
      periodEnd: this.date(period?.[2]),
      statementDate,
      paymentDueDate,
      previousBalance: this.amountAfter(
        text,
        /Adeudo del periodo anterior\s*=?\s*\$\s*([\d,]+\.\d{2})/i,
      ),
      totalCharges: this.amountAfter(
        text,
        /Total cargos\s*\+?\s*\$\s*([\d,]+\.\d{2})/i,
      ),
      totalCredits: this.amountAfter(
        text,
        /Total abonos\s*-?\s*\$\s*([\d,]+\.\d{2})/i,
      ),
      statementBalance: regularBalance ?? noInterestPayment,
      noInterestPayment,
      minimumPayment: this.amountAfter(
        text,
        /^Pago m[ií]nimo:\s*\d*\s*\$\s*([\d,]+\.\d{2})/im,
      ),
      lines: this.movements(lines),
    });
  }

  private movements(lines: string[]): ParsedStatementLine[] {
    const movements: ParsedStatementLine[] = [];
    let inRegularSection = false;

    for (const line of lines) {
      if (line.startsWith(REGULAR_SECTION)) {
        inRegularSection = true;
        continue;
      }
      // Any other table header ends the section (page headers and column
      // titles between rows don't match a movement and are skipped).
      if (
        line.startsWith('COMPRAS Y CARGOS DIFERIDOS') ||
        /^Total (cargos|abonos)/i.test(line)
      ) {
        inRegularSection = false;
        continue;
      }
      if (!inRegularSection) continue;

      const match = MOVEMENT.exec(line);
      if (!match) continue;
      const [, operationDate, postDate, rawDescription, sign, rawAmount] =
        match;
      const date = parseDate(operationDate);
      const amount = parseAmount(rawAmount);
      if (!date || amount === null) continue;

      const installment = INSTALLMENT.exec(rawDescription);
      const description = rawDescription.trim();
      movements.push({
        date,
        postDate: parseDate(postDate) ?? undefined,
        description,
        merchant: this.merchant(description),
        amount,
        kind: this.kind(description, sign, Boolean(installment)),
        installmentNumber: installment ? Number(installment[1]) : undefined,
        installmentTotal: installment ? Number(installment[2]) : undefined,
      });
    }
    return movements;
  }

  private kind(
    description: string,
    sign: string,
    isInstallment: boolean,
  ): ImportedLineKind {
    const text = description.toUpperCase();
    if (sign === '-') {
      return /ABONO|PAGO|GRACIAS/.test(text)
        ? ImportedLineKind.payment
        : ImportedLineKind.refund;
    }
    if (isInstallment) return ImportedLineKind.installment;
    if (/INTERES/.test(text)) return ImportedLineKind.interest;
    if (/COMISION|ANUALIDAD|IVA /.test(text)) return ImportedLineKind.fee;
    return ImportedLineKind.charge;
  }

  /** Description without the bank's suffixes: tax id and "007 de 012". */
  private merchant(description: string): string {
    return description
      .replace(INSTALLMENT, '')
      .replace(MERCHANT_RFC, '')
      .trim();
  }

  private match(text: string, pattern: RegExp) {
    return pattern.exec(text) ?? undefined;
  }

  private amountAfter(text: string, pattern: RegExp): number | undefined {
    const raw = pattern.exec(text)?.[1];
    return raw ? (parseAmount(raw) ?? undefined) : undefined;
  }

  private date(raw?: string): string | undefined {
    return raw ? (parseDate(raw) ?? undefined) : undefined;
  }
}
