import { AiFeatureKey, ImportedLineKind } from '@finnit/database';
import {
  AiModelsService,
  NoUsableAiModelError,
} from '../../ai/ai-models.service';
import { AiProviderError, JsonSchema } from '../../ai/providers/ai-provider';
import {
  ParsedStatement,
  ParsedStatementLine,
  StatementParseError,
} from './parsed-statement';
import { parseDate } from './parse-utils';

const SCHEMA_NAME = 'record_statement';

const LINE_KINDS = Object.values(ImportedLineKind);

const PROMPT = `Extract this credit card statement into the ${SCHEMA_NAME} structure.

Rules:
- Dates as YYYY-MM-DD. Amounts as positive numbers without currency symbols or thousands separators.
- Include every movement of the period exactly once: purchases, monthly installments of "meses sin intereses" plans, fees ("comisiones"), interest ("intereses"), taxes on fees or interest (as fee), payments ("pagos") and refunds ("devoluciones", "bonificaciones").
- kind: charge (purchase), installment (monthly installment of a plan; set installmentNumber and installmentTotal from text like "3 de 12"), fee, interest, payment (payment to the card), refund.
- Do not include the plan summary tables (remaining balances of installment plans) as movements; only the installment charged this period.
- previousBalance is the balance of the previous cut-off ("saldo anterior", "adeudo del periodo anterior").
- statementBalance is the balance at cut-off WITHOUT the not-yet-billed remainder of installment plans, so that previousBalance + charges - credits = statementBalance. It is usually "saldo al corte", "saldo cargos regulares" or the "pago para no generar intereses"; never "saldo deudor total" when that includes pending installment balances.
- noInterestPayment is "pago para no generar intereses"; minimumPayment is "pago mínimo".
- Omit any field that the statement does not show. Never invent values.`;

const SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    currency: { type: 'string', description: 'ISO 4217, e.g. MXN' },
    cardLast4: { type: 'string' },
    periodStart: { type: 'string' },
    periodEnd: { type: 'string' },
    statementDate: { type: 'string', description: 'Cut-off date' },
    paymentDueDate: { type: 'string' },
    previousBalance: { type: 'number' },
    totalCharges: { type: 'number' },
    totalCredits: { type: 'number' },
    statementBalance: { type: 'number' },
    noInterestPayment: { type: 'number' },
    minimumPayment: { type: 'number' },
    lines: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          date: { type: 'string' },
          postDate: { type: 'string' },
          description: { type: 'string' },
          merchant: { type: 'string' },
          amount: { type: 'number' },
          kind: { type: 'string', enum: LINE_KINDS },
          installmentNumber: { type: 'integer' },
          installmentTotal: { type: 'integer' },
        },
        required: ['date', 'description', 'amount', 'kind'],
      },
    },
  },
  required: ['currency', 'lines'],
};

/**
 * Fallback for statement formats without a local parser: sends the PDF to
 * the AI model catalog (default model first, then the next active ones) and
 * validates the structured answer.
 *
 * The statement leaves our infrastructure (the provider's API), so it is the
 * last resort after local parsers.
 */
export class AiStatementParser {
  /** Prefix of StatementImport.parser, e.g. "ai:anthropic/claude-haiku-5-5". */
  static readonly ID = 'ai';

  constructor(private readonly aiModels: AiModelsService) {}

  async parse(
    pdf: Buffer,
    aiModelId?: string,
  ): Promise<{ parserId: string; statement: ParsedStatement }> {
    try {
      const { model, data } = await this.aiModels.extractFromPdf(
        { pdf, prompt: PROMPT, schema: SCHEMA, schemaName: SCHEMA_NAME },
        { aiModelId, feature: AiFeatureKey.statement_parsing },
      );
      return {
        parserId: `${AiStatementParser.ID}:${model.provider}/${model.modelId}`,
        statement: sanitize((data ?? {}) as Record<string, unknown>),
      };
    } catch (error) {
      if (error instanceof NoUsableAiModelError) {
        throw new StatementParseError(error.message);
      }
      if (error instanceof AiProviderError) {
        throw new StatementParseError('AI extraction failed');
      }
      throw error;
    }
  }
}

/** The model's output is untrusted: keep only well-formed fields. */
export function sanitize(input: Record<string, unknown>): ParsedStatement {
  const num = (value: unknown) =>
    typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  const date = (value: unknown) =>
    typeof value === 'string' ? (parseDate(value) ?? undefined) : undefined;
  const str = (value: unknown) =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined;
  const int = (value: unknown) =>
    Number.isInteger(value) && (value as number) > 0
      ? (value as number)
      : undefined;

  const rawLines = Array.isArray(input.lines) ? input.lines : [];
  const lines: ParsedStatementLine[] = [];
  for (const raw of rawLines as Record<string, unknown>[]) {
    const lineDate = date(raw?.date);
    const amount = num(raw?.amount);
    const description = str(raw?.description);
    const kind = LINE_KINDS.find((k) => k === raw?.kind);
    if (!lineDate || amount === undefined || !description || !kind) continue;
    lines.push({
      date: lineDate,
      postDate: date(raw.postDate),
      description,
      merchant: str(raw.merchant),
      amount: Math.abs(amount),
      kind,
      installmentNumber: int(raw.installmentNumber),
      installmentTotal: int(raw.installmentTotal),
    });
  }

  const currency = str(input.currency)?.toUpperCase();
  return {
    currency: currency && /^[A-Z]{3}$/.test(currency) ? currency : 'MXN',
    cardLast4: str(input.cardLast4)?.replace(/\D/g, '').slice(-4) || undefined,
    periodStart: date(input.periodStart),
    periodEnd: date(input.periodEnd),
    statementDate: date(input.statementDate),
    paymentDueDate: date(input.paymentDueDate),
    previousBalance: num(input.previousBalance),
    totalCharges: num(input.totalCharges),
    totalCredits: num(input.totalCredits),
    statementBalance: num(input.statementBalance),
    noInterestPayment: num(input.noInterestPayment),
    minimumPayment: num(input.minimumPayment),
    lines,
  };
}
