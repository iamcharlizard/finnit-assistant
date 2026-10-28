import { AiFeatureKey } from '@finnit/database';
import { AiModelsService } from '../ai/ai-models.service';
import { JsonSchema } from '../ai/providers/ai-provider';
import { normalizeTaxId } from './receipt-rules';

const SCHEMA_NAME = 'record_receipt';

const PROMPT = `The text below is the OCR of a photo of a Mexican store receipt ("ticket"), one line per OCR line. Extract it into the ${SCHEMA_NAME} structure.

Rules:
- total: the amount paid for the purchase (TOTAL / TOTAL A PAGAR), a positive number without currency symbols or thousands separators. Not the subtotal, tax (IVA), cash given (EFECTIVO), change (CAMBIO) or savings (AHORRO).
- date: purchase date as YYYY-MM-DD. Mexican receipts print the day first.
- merchantName: the business name as a customer would recognize it (e.g. the brand, not the legal entity suffix "S.A. de C.V.").
- taxId: the merchant's RFC (12 or 13 characters), never XAXX010101000.
- Omit any field that the text does not show. Never invent values.`;

const SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    total: { type: 'number' },
    date: { type: 'string', description: 'YYYY-MM-DD' },
    merchantName: { type: 'string' },
    taxId: { type: 'string', description: 'RFC' },
  },
  required: [],
};

/** OCR text is short; cap it so a garbage photo cannot cost much. */
const MAX_TEXT_CHARS = 6_000;
const AI_TIMEOUT_MS = 30_000;

export interface AiReceiptFields {
  total?: number;
  date?: string;
  merchantName?: string;
  taxId?: string;
}

/**
 * AI fallback for receipts (feature `receipt_parsing`, off by default):
 * sends the OCR TEXT, never the image. Throws NoUsableAiModelError when the
 * feature is off or no model is usable; the caller keeps the local result.
 */
export async function extractReceiptWithAi(
  aiModels: AiModelsService,
  ocrText: string,
  today: Date,
): Promise<{ model: string; fields: AiReceiptFields }> {
  const { model, data } = await aiModels.extractFromText(
    {
      prompt: PROMPT,
      text: ocrText.slice(0, MAX_TEXT_CHARS),
      schema: SCHEMA,
      schemaName: SCHEMA_NAME,
      timeoutMs: AI_TIMEOUT_MS,
    },
    { feature: AiFeatureKey.receipt_parsing },
  );
  return {
    model: `${model.provider}/${model.modelId}`,
    fields: sanitizeAiReceipt(data, today),
  };
}

/** The model's output is untrusted: keep only well-formed, plausible fields. */
export function sanitizeAiReceipt(data: unknown, today: Date): AiReceiptFields {
  const raw = (data ?? {}) as Record<string, unknown>;
  const fields: AiReceiptFields = {};

  if (
    typeof raw.total === 'number' &&
    Number.isFinite(raw.total) &&
    raw.total > 0 &&
    raw.total < 10_000_000
  ) {
    fields.total = Math.round(raw.total * 100) / 100;
  }

  if (typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date)) {
    const date = new Date(`${raw.date}T00:00:00.000Z`);
    const oldest = new Date(today.getTime() - 2 * 366 * 86_400_000);
    if (
      !Number.isNaN(date.getTime()) &&
      date.toISOString().slice(0, 10) === raw.date &&
      date <= today &&
      date >= oldest
    ) {
      fields.date = raw.date;
    }
  }

  if (typeof raw.merchantName === 'string') {
    const name = raw.merchantName.replace(/\s+/g, ' ').trim().slice(0, 80);
    if (name.length >= 2) fields.merchantName = name;
  }

  if (typeof raw.taxId === 'string') {
    const taxId = normalizeTaxId(raw.taxId);
    if (taxId && taxId !== 'XAXX010101000' && taxId !== 'XEXX010101000') {
      fields.taxId = taxId;
    }
  }
  return fields;
}
