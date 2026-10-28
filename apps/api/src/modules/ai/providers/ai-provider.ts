import { AiProvider } from '@finnit/database';

/** A JSON Schema object (the subset every provider accepts). */
export type JsonSchema = Record<string, unknown>;

export interface PdfExtractionRequest {
  modelId: string;
  pdf: Buffer;
  /** Instructions sent with the document. */
  prompt: string;
  /** Shape of the answer; providers enforce it with tool calls or JSON mode. */
  schema: JsonSchema;
  /** Short identifier of the schema (tool / format name). */
  schemaName: string;
}

export interface TextExtractionRequest {
  modelId: string;
  /** Instructions for the model. */
  prompt: string;
  /** The input to work on (sent as its own text block, after the prompt). */
  text: string;
  /** Shape of the answer; providers enforce it with tool calls or JSON mode. */
  schema: JsonSchema;
  /** Short identifier of the schema (tool / format name). */
  schemaName: string;
  /** Per-call timeout; providers keep their own default otherwise. */
  timeoutMs?: number;
}

/** One AI provider. Keys come from env vars; without a key it is not configured. */
export interface AiProviderClient {
  readonly provider: AiProvider;
  /** Name of the env var holding the API key, for error messages and docs. */
  readonly apiKeyEnv: string;
  readonly isConfigured: boolean;
  /** Returns the parsed JSON answer. It is untrusted: validate it. */
  extractFromPdf(request: PdfExtractionRequest): Promise<unknown>;
  /** Same as extractFromPdf, for plain text input. */
  extractFromText(request: TextExtractionRequest): Promise<unknown>;
}

/** A provider call failed; the message never contains the API key. */
export class AiProviderError extends Error {
  constructor(
    readonly provider: AiProvider,
    message: string,
  ) {
    super(`${provider}: ${message}`);
  }
}

/** Reads the provider's error message from a failed HTTP response. */
export async function describeHttpError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      error?: { message?: string } | string;
    };
    const message =
      typeof body.error === 'string' ? body.error : body.error?.message;
    return `HTTP ${response.status}${message ? `: ${message}` : ''}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

export function parseJson(provider: AiProvider, text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new AiProviderError(provider, 'the answer is not valid JSON');
  }
}
