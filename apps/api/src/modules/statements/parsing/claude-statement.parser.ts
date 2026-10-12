import Anthropic from '@anthropic-ai/sdk';
import { ImportedLineKind } from '@finnit/database';
import {
  ParsedStatement,
  ParsedStatementLine,
  StatementParseError,
  StatementParser,
} from './parsed-statement';
import { parseDate } from './parse-utils';

const TOOL_NAME = 'record_statement';
const DEFAULT_MODEL = 'claude-haiku-5-5';

const LINE_KINDS = Object.values(ImportedLineKind);

const PROMPT = `Extract this credit card statement into the ${TOOL_NAME} tool.

Rules:
- Dates as YYYY-MM-DD. Amounts as positive numbers without currency symbols or thousands separators.
- Include every movement of the period exactly once: purchases, monthly installments of "meses sin intereses" plans, fees ("comisiones"), interest ("intereses"), taxes on fees or interest (as fee), payments ("pagos") and refunds ("devoluciones", "bonificaciones").
- kind: charge (purchase), installment (monthly installment of a plan; set installmentNumber and installmentTotal from text like "3 de 12"), fee, interest, payment (payment to the card), refund.
- Do not include the plan summary tables (remaining balances of installment plans) as movements; only the installment charged this period.
- statementBalance is the balance at cut-off ("saldo al corte" / "saldo deudor total"). previousBalance is the balance of the previous cut-off ("saldo anterior").
- noInterestPayment is "pago para no generar intereses"; minimumPayment is "pago mínimo".
- Omit any field that the statement does not show. Never invent values.`;

const TOOL: Anthropic.Messages.Tool = {
  name: TOOL_NAME,
  description: 'Records the totals and movements of a credit card statement.',
  input_schema: {
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
  },
};

/**
 * Fallback for statement formats without a local parser: sends the PDF to
 * Claude and reads the totals and movements through a forced tool call.
 *
 * Enabled only when ANTHROPIC_API_KEY is set. The statement leaves our
 * infrastructure (Anthropic API), so it is the last resort after local parsers.
 */
export class ClaudeStatementParser implements StatementParser {
  readonly id = 'claude';
  private readonly client?: Anthropic;
  private readonly model = process.env.STATEMENT_AI_MODEL ?? DEFAULT_MODEL;

  constructor(apiKey = process.env.ANTHROPIC_API_KEY, client?: Anthropic) {
    this.client = client ?? (apiKey ? new Anthropic({ apiKey }) : undefined);
  }

  get isEnabled(): boolean {
    return Boolean(this.client);
  }

  canParse(): boolean {
    return this.isEnabled;
  }

  async parse({ pdf }: { pdf: Buffer }): Promise<ParsedStatement> {
    if (!this.client) {
      throw new StatementParseError('AI extraction is not configured');
    }

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 16000,
      tools: [TOOL],
      tool_choice: { type: 'tool', name: TOOL_NAME },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdf.toString('base64'),
              },
            },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    });

    if (response.stop_reason === 'max_tokens') {
      throw new StatementParseError(
        'The statement is too long for AI extraction',
      );
    }
    const toolUse = response.content.find(
      (block): block is Anthropic.Messages.ToolUseBlock =>
        block.type === 'tool_use' && block.name === TOOL_NAME,
    );
    if (!toolUse) {
      throw new StatementParseError('AI extraction returned no data');
    }
    return sanitize(toolUse.input as Record<string, unknown>);
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
