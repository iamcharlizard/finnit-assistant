import { AiProvider } from '@finnit/database';
import {
  AiProviderClient,
  AiProviderError,
  JsonSchema,
  PdfExtractionRequest,
  describeHttpError,
  parseJson,
} from './ai-provider';

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const TIMEOUT_MS = 180_000;

interface GenerateContentResult {
  candidates?: {
    finishReason?: string;
    content?: { parts?: { text?: string }[] };
  }[];
  promptFeedback?: { blockReason?: string };
}

/**
 * Gemini's responseSchema is an OpenAPI subset: drop the JSON Schema keys it
 * rejects (e.g. `additionalProperties`).
 */
export function toGeminiSchema(schema: JsonSchema): JsonSchema {
  const unsupported = new Set(['additionalProperties', '$schema']);
  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .filter(([key]) => !unsupported.has(key))
          .map(([key, inner]) => [key, walk(inner)]),
      );
    }
    return value;
  };
  return walk(schema) as JsonSchema;
}

/** Gemini generateContent: PDF as `inline_data`, answer in JSON mode with a schema. */
export class GoogleProvider implements AiProviderClient {
  readonly provider = AiProvider.google;
  readonly apiKeyEnv = 'GEMINI_API_KEY';

  constructor(
    private readonly apiKey = process.env.GEMINI_API_KEY,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  get isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async extractFromPdf(request: PdfExtractionRequest): Promise<unknown> {
    if (!this.apiKey) {
      throw new AiProviderError(this.provider, `${this.apiKeyEnv} is not set`);
    }

    let response: Response;
    try {
      // The key goes in a header, not the query string, so it never shows up
      // in URLs or error messages.
      response = await this.fetchFn(
        `${BASE_URL}/${encodeURIComponent(request.modelId)}:generateContent`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-goog-api-key': this.apiKey,
          },
          signal: AbortSignal.timeout(TIMEOUT_MS),
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    inline_data: {
                      mime_type: 'application/pdf',
                      data: request.pdf.toString('base64'),
                    },
                  },
                  { text: request.prompt },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema: toGeminiSchema(request.schema),
            },
          }),
        },
      );
    } catch (error) {
      throw new AiProviderError(this.provider, (error as Error).message);
    }
    if (!response.ok) {
      throw new AiProviderError(
        this.provider,
        await describeHttpError(response),
      );
    }

    const result = (await response.json()) as GenerateContentResult;
    if (result.promptFeedback?.blockReason) {
      throw new AiProviderError(
        this.provider,
        `blocked (${result.promptFeedback.blockReason})`,
      );
    }
    const candidate = result.candidates?.[0];
    if (candidate?.finishReason === 'MAX_TOKENS') {
      throw new AiProviderError(this.provider, 'the answer was cut off');
    }
    const text = (candidate?.content?.parts ?? [])
      .map((part) => part.text ?? '')
      .join('');
    if (!text) {
      throw new AiProviderError(this.provider, 'the answer has no data');
    }
    return parseJson(this.provider, text);
  }
}
