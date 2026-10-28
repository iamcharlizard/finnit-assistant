import { AiProvider } from '@finnit/database';
import {
  AiProviderClient,
  AiProviderError,
  JsonSchema,
  PdfExtractionRequest,
  TextExtractionRequest,
  describeHttpError,
  parseJson,
} from './ai-provider';

const ENDPOINT = 'https://api.openai.com/v1/responses';
const TIMEOUT_MS = 180_000;

interface ResponsesApiResult {
  status?: string;
  incomplete_details?: { reason?: string } | null;
  output?: {
    type: string;
    content?: { type: string; text?: string; refusal?: string }[];
  }[];
}

/**
 * OpenAI Responses API: PDF as an `input_file` (or plain `input_text`),
 * answer as JSON-schema output.
 */
export class OpenAiProvider implements AiProviderClient {
  readonly provider = AiProvider.openai;
  readonly apiKeyEnv = 'OPENAI_API_KEY';

  constructor(
    private readonly apiKey = process.env.OPENAI_API_KEY,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  get isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async extractFromPdf(request: PdfExtractionRequest): Promise<unknown> {
    return this.call(request, [
      {
        type: 'input_file',
        filename: 'statement.pdf',
        file_data: `data:application/pdf;base64,${request.pdf.toString('base64')}`,
      },
      { type: 'input_text', text: request.prompt },
    ]);
  }

  async extractFromText(request: TextExtractionRequest): Promise<unknown> {
    return this.call(
      request,
      [
        { type: 'input_text', text: request.prompt },
        { type: 'input_text', text: request.text },
      ],
      request.timeoutMs,
    );
  }

  private async call(
    request: { modelId: string; schema: JsonSchema; schemaName: string },
    content: Record<string, unknown>[],
    timeoutMs = TIMEOUT_MS,
  ): Promise<unknown> {
    if (!this.apiKey) {
      throw new AiProviderError(this.provider, `${this.apiKeyEnv} is not set`);
    }

    let response: Response;
    try {
      response = await this.fetchFn(ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.apiKey}`,
        },
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify({
          model: request.modelId,
          input: [{ role: 'user', content }],
          text: {
            format: {
              type: 'json_schema',
              name: request.schemaName,
              schema: request.schema,
              strict: false,
            },
          },
        }),
      });
    } catch (error) {
      throw new AiProviderError(this.provider, (error as Error).message);
    }
    if (!response.ok) {
      throw new AiProviderError(
        this.provider,
        await describeHttpError(response),
      );
    }

    const result = (await response.json()) as ResponsesApiResult;
    if (result.status === 'incomplete') {
      throw new AiProviderError(
        this.provider,
        `incomplete answer (${result.incomplete_details?.reason ?? 'unknown'})`,
      );
    }
    const parts = (result.output ?? [])
      .filter((item) => item.type === 'message')
      .flatMap((item) => item.content ?? []);
    const refusal = parts.find((part) => part.refusal);
    if (refusal) {
      throw new AiProviderError(this.provider, 'the model refused the request');
    }
    const text = parts
      .filter((part) => part.type === 'output_text')
      .map((part) => part.text ?? '')
      .join('');
    if (!text) {
      throw new AiProviderError(this.provider, 'the answer has no data');
    }
    return parseJson(this.provider, text);
  }
}
