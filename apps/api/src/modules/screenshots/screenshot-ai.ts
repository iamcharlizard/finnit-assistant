import { AiFeatureKey } from '@finnit/database';
import { AiModelsService } from '../ai/ai-models.service';
import { JsonSchema } from '../ai/providers/ai-provider';
import type {
  ShotExtraction,
  ShotMovement,
  ShotOcrLine,
} from './screenshot-rules';

const SCHEMA_NAME = 'record_movements';

const PROMPT = `The text below is the OCR of a screenshot of a Mexican bank app's list of movements, one OCR line per row as "y | text" (y is the vertical position in pixels, top = 0). Extract it into the ${SCHEMA_NAME} structure.

Rules:
- account: the account or card name shown at the top (e.g. "Clásica Banamex **482"); last4: its last digits after the asterisks (3 or 4 digits).
- movements: one per movement row, top to bottom. Ignore tabs, headings ("Anteriores", "Tus movimientos"), counts ("60 movimientos"), logos and the phone's status bar.
- merchant: the name as shown. amount: positive number without currency symbol or separators.
- date: YYYY-MM-DD; the screenshot usually shows only day and month, so use the latest such date that is not after today (TODAY below).
- direction: "in" for payments, deposits or refunds into the account ("+", abono, depósito, devolución); otherwise "out".
- inProcess: true when the row says "En proceso", "Pendiente" or similar.
- Omit any field the text does not show. Never invent movements or values.`;

const SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    account: { type: 'string' },
    last4: { type: 'string' },
    movements: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          merchant: { type: 'string' },
          amount: { type: 'number' },
          date: { type: 'string', description: 'YYYY-MM-DD' },
          direction: { type: 'string', enum: ['in', 'out'] },
          inProcess: { type: 'boolean' },
        },
        required: [],
      },
    },
  },
  required: ['movements'],
};

const MAX_TEXT_CHARS = 8_000;
const AI_TIMEOUT_MS = 30_000;
/** More rows than this in one screenshot is not plausible. */
const MAX_MOVEMENTS = 60;

/** The OCR lines as the AI reads them: "y | text", top to bottom. */
export function linesForAi(lines: ReadonlyArray<ShotOcrLine>): string {
  return [...lines]
    .map((line) => ({
      y: Math.round(Math.min(...line.box.map((p) => p[1]))),
      text: line.text.trim(),
    }))
    .filter((line) => line.text)
    .sort((a, b) => a.y - b.y)
    .map((line) => `${line.y} | ${line.text}`)
    .join('\n');
}

/**
 * AI fallback for screenshots (feature `screenshot_parsing`, off by
 * default): sends the OCR TEXT with positions, never the image. Throws
 * NoUsableAiModelError when the feature is off or no model is usable.
 */
export async function extractScreenshotWithAi(
  aiModels: AiModelsService,
  lines: ReadonlyArray<ShotOcrLine>,
  today: Date,
): Promise<{ model: string; extraction: ShotExtraction }> {
  const todayIso = today.toISOString().slice(0, 10);
  const { model, data } = await aiModels.extractFromText(
    {
      prompt: `${PROMPT}\n\nTODAY: ${todayIso}`,
      text: linesForAi(lines).slice(0, MAX_TEXT_CHARS),
      schema: SCHEMA,
      schemaName: SCHEMA_NAME,
      timeoutMs: AI_TIMEOUT_MS,
    },
    { feature: AiFeatureKey.screenshot_parsing },
  );
  return {
    model: `${model.provider}/${model.modelId}`,
    extraction: sanitizeAiScreenshot(data, today),
  };
}

/** The model's output is untrusted: keep only well-formed, plausible values. */
export function sanitizeAiScreenshot(
  data: unknown,
  today: Date,
): ShotExtraction {
  const raw = (data ?? {}) as Record<string, unknown>;
  const todayIso = today.toISOString().slice(0, 10);
  const oldest = new Date(today.getTime() - 366 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const text = (value: unknown, max: number) =>
    typeof value === 'string'
      ? value.replace(/\s+/g, ' ').trim().slice(0, max) || null
      : null;
  const last4 =
    typeof raw.last4 === 'string' && /^\d{3,4}$/.test(raw.last4.trim())
      ? raw.last4.trim()
      : null;

  const movements: ShotMovement[] = (
    Array.isArray(raw.movements) ? raw.movements : []
  )
    .slice(0, MAX_MOVEMENTS)
    .map((item) => {
      const m = (item ?? {}) as Record<string, unknown>;
      const amount =
        typeof m.amount === 'number' &&
        Number.isFinite(m.amount) &&
        m.amount > 0 &&
        m.amount < 10_000_000
          ? Math.round(m.amount * 100) / 100
          : null;
      const date =
        typeof m.date === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(m.date) &&
        !Number.isNaN(Date.parse(`${m.date}T00:00:00Z`)) &&
        m.date <= todayIso &&
        m.date >= oldest
          ? m.date
          : null;
      const merchant = text(m.merchant, 120);
      const review: ShotMovement['review'] = [];
      if (!date) review.push('date');
      if (!merchant) review.push('merchant');
      if (amount === null) review.push('amount');
      return {
        date,
        merchant,
        amount,
        direction: m.direction === 'in' ? 'in' : 'out',
        inProcess: m.inProcess === true,
        review,
      } satisfies ShotMovement;
    })
    // A row without amount nor merchant is not a movement.
    .filter((m) => m.amount !== null || m.merchant !== null);

  return { accountHint: text(raw.account, 120), last4, movements };
}
