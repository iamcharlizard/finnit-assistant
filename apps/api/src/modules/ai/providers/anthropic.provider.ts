import Anthropic from '@anthropic-ai/sdk';
import { AiProvider } from '@finnit/database';
import {
  AiProviderClient,
  AiProviderError,
  PdfExtractionRequest,
} from './ai-provider';

/** Anthropic Messages API: PDF as a `document` block, answer through a forced tool call. */
export class AnthropicProvider implements AiProviderClient {
  readonly provider = AiProvider.anthropic;
  readonly apiKeyEnv = 'ANTHROPIC_API_KEY';
  private readonly client?: Anthropic;

  constructor(apiKey = process.env.ANTHROPIC_API_KEY, client?: Anthropic) {
    this.client = client ?? (apiKey ? new Anthropic({ apiKey }) : undefined);
  }

  get isConfigured(): boolean {
    return Boolean(this.client);
  }

  async extractFromPdf(request: PdfExtractionRequest): Promise<unknown> {
    if (!this.client) {
      throw new AiProviderError(this.provider, `${this.apiKeyEnv} is not set`);
    }

    let response: Anthropic.Messages.Message;
    try {
      response = await this.client.messages.create({
        model: request.modelId,
        max_tokens: 16000,
        tools: [
          {
            name: request.schemaName,
            description: 'Records the extracted data.',
            input_schema: request.schema as Anthropic.Messages.Tool.InputSchema,
          },
        ],
        tool_choice: { type: 'tool', name: request.schemaName },
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: request.pdf.toString('base64'),
                },
              },
              { type: 'text', text: request.prompt },
            ],
          },
        ],
      });
    } catch (error) {
      throw new AiProviderError(this.provider, (error as Error).message);
    }

    if (response.stop_reason === 'max_tokens') {
      throw new AiProviderError(this.provider, 'the answer was cut off');
    }
    const toolUse = response.content.find(
      (block): block is Anthropic.Messages.ToolUseBlock =>
        block.type === 'tool_use' && block.name === request.schemaName,
    );
    if (!toolUse) {
      throw new AiProviderError(this.provider, 'the answer has no data');
    }
    return toolUse.input;
  }
}
