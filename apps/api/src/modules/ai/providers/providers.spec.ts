import type Anthropic from '@anthropic-ai/sdk';
import {
  AiProviderError,
  PdfExtractionRequest,
  TextExtractionRequest,
} from './ai-provider';
import { AnthropicProvider } from './anthropic.provider';
import { GoogleProvider, toGeminiSchema } from './google.provider';
import { OpenAiProvider } from './openai.provider';

const pdf = Buffer.from('%PDF-1.7 test');
const request: PdfExtractionRequest = {
  modelId: 'model-x',
  pdf,
  prompt: 'Extract it',
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: { total: { type: 'number' } },
  },
  schemaName: 'record_statement',
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

type FetchMock = jest.Mock<Promise<Response>, Parameters<typeof fetch>>;
const fetchReturning = (response: Response): FetchMock =>
  jest
    .fn<Promise<Response>, Parameters<typeof fetch>>()
    .mockResolvedValue(response);
interface SentBody {
  model?: string;
  input: { content: unknown[] }[];
  text: { format: unknown };
  contents: { parts: unknown[] }[];
  generationConfig: { responseMimeType: string; responseSchema: unknown };
}
const sentBody = (mock: FetchMock) =>
  JSON.parse(mock.mock.calls[0][1]!.body as string) as SentBody;
const sentHeaders = (mock: FetchMock) =>
  mock.mock.calls[0][1]!.headers as Record<string, string>;

describe('AnthropicProvider', () => {
  const clientReturning = (response: Partial<Anthropic.Messages.Message>) => {
    const create = jest
      .fn<Promise<unknown>, [Anthropic.Messages.MessageCreateParams]>()
      .mockResolvedValue(response);
    return { client: { messages: { create } } as unknown as Anthropic, create };
  };

  it('is not configured without a key', async () => {
    const provider = new AnthropicProvider('');
    expect(provider.isConfigured).toBe(false);
    await expect(provider.extractFromPdf(request)).rejects.toThrow(
      'ANTHROPIC_API_KEY is not set',
    );
  });

  it('sends the PDF as a document and forces the schema tool', async () => {
    const { client, create } = clientReturning({
      stop_reason: 'tool_use',
      content: [
        {
          type: 'tool_use',
          id: 't1',
          name: 'record_statement',
          input: { total: 10 },
        } as Anthropic.Messages.ToolUseBlock,
      ],
    });

    const data = await new AnthropicProvider(undefined, client).extractFromPdf(
      request,
    );

    const sent = create.mock.calls[0][0];
    expect(sent.model).toBe('model-x');
    expect(sent.tool_choice).toEqual({
      type: 'tool',
      name: 'record_statement',
    });
    expect((sent.messages[0].content as { type: string }[])[0].type).toBe(
      'document',
    );
    expect(data).toEqual({ total: 10 });
  });

  it('fails when the answer was cut off', async () => {
    const { client } = clientReturning({
      stop_reason: 'max_tokens',
      content: [],
    });
    await expect(
      new AnthropicProvider(undefined, client).extractFromPdf(request),
    ).rejects.toThrow(AiProviderError);
  });
});

describe('OpenAiProvider', () => {
  it('sends the PDF as input_file with a JSON schema format', async () => {
    const fetchMock = fetchReturning(
      jsonResponse({
        status: 'completed',
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text: '{"total":10}' }],
          },
        ],
      }),
    );

    const data = await new OpenAiProvider('sk-test', fetchMock).extractFromPdf(
      request,
    );

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.openai.com/v1/responses',
    );
    expect(sentHeaders(fetchMock).authorization).toBe('Bearer sk-test');
    const body = sentBody(fetchMock);
    expect(body.model).toBe('model-x');
    expect(body.input[0].content[0]).toEqual({
      type: 'input_file',
      filename: 'statement.pdf',
      file_data: `data:application/pdf;base64,${pdf.toString('base64')}`,
    });
    expect(body.text.format).toEqual(
      expect.objectContaining({
        type: 'json_schema',
        name: 'record_statement',
      }),
    );
    expect(data).toEqual({ total: 10 });
  });

  it('surfaces the API error message without the key', async () => {
    const fetchMock = fetchReturning(
      jsonResponse({ error: { message: 'model not found' } }, 404),
    );
    const error = (await new OpenAiProvider('sk-secret', fetchMock)
      .extractFromPdf(request)
      .catch((e: unknown) => e)) as Error;
    expect(error.message).toBe('openai: HTTP 404: model not found');
    expect(error.message).not.toContain('sk-secret');
  });

  it('rejects refusals and incomplete answers', async () => {
    await expect(
      new OpenAiProvider(
        'k',
        fetchReturning(
          jsonResponse({
            output: [
              {
                type: 'message',
                content: [{ type: 'refusal', refusal: 'no' }],
              },
            ],
          }),
        ),
      ).extractFromPdf(request),
    ).rejects.toThrow('refused');
    await expect(
      new OpenAiProvider(
        'k',
        fetchReturning(
          jsonResponse({
            status: 'incomplete',
            incomplete_details: { reason: 'max_output_tokens' },
          }),
        ),
      ).extractFromPdf(request),
    ).rejects.toThrow('incomplete');
  });
});

describe('GoogleProvider', () => {
  it('sends the PDF inline with a response schema and the key in a header', async () => {
    const fetchMock = fetchReturning(
      jsonResponse({
        candidates: [
          {
            finishReason: 'STOP',
            content: { parts: [{ text: '{"total":10}' }] },
          },
        ],
      }),
    );

    const data = await new GoogleProvider('g-key', fetchMock).extractFromPdf(
      request,
    );

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/model-x:generateContent',
    );
    expect(url).not.toContain('g-key');
    expect(sentHeaders(fetchMock)['x-goog-api-key']).toBe('g-key');
    const body = sentBody(fetchMock);
    expect(body.contents[0].parts[0]).toEqual({
      inline_data: {
        mime_type: 'application/pdf',
        data: pdf.toString('base64'),
      },
    });
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.responseSchema).not.toHaveProperty(
      'additionalProperties',
    );
    expect(data).toEqual({ total: 10 });
  });

  it('fails on blocked or truncated answers', async () => {
    await expect(
      new GoogleProvider(
        'k',
        fetchReturning(
          jsonResponse({ promptFeedback: { blockReason: 'SAFETY' } }),
        ),
      ).extractFromPdf(request),
    ).rejects.toThrow('blocked');
    await expect(
      new GoogleProvider(
        'k',
        fetchReturning(
          jsonResponse({ candidates: [{ finishReason: 'MAX_TOKENS' }] }),
        ),
      ).extractFromPdf(request),
    ).rejects.toThrow('cut off');
  });

  it('removes unsupported keys at every level of the schema', () => {
    expect(
      toGeminiSchema({
        type: 'object',
        additionalProperties: false,
        properties: {
          items: {
            type: 'array',
            items: { type: 'object', additionalProperties: false },
          },
        },
      }),
    ).toEqual({
      type: 'object',
      properties: { items: { type: 'array', items: { type: 'object' } } },
    });
  });
});

describe('extractFromText', () => {
  const textRequest: TextExtractionRequest = {
    modelId: 'model-x',
    prompt: 'Translate the category name',
    text: 'Mascotas',
    schema: { type: 'object', properties: { en: { type: 'string' } } },
    schemaName: 'record_translation',
    timeoutMs: 3000,
  };

  it('Anthropic sends prompt and text as text blocks with the timeout', async () => {
    const create = jest.fn().mockResolvedValue({
      stop_reason: 'tool_use',
      content: [
        {
          type: 'tool_use',
          id: 't1',
          name: 'record_translation',
          input: { en: 'Pets' },
        },
      ],
    });
    const client = { messages: { create } } as unknown as Anthropic;

    const data = await new AnthropicProvider(undefined, client).extractFromText(
      textRequest,
    );

    expect(data).toEqual({ en: 'Pets' });
    const [sent, options] = create.mock.calls[0] as [
      Anthropic.Messages.MessageCreateParams,
      { timeout: number },
    ];
    expect(sent.messages[0].content).toEqual([
      { type: 'text', text: 'Translate the category name' },
      { type: 'text', text: 'Mascotas' },
    ]);
    expect(sent.tool_choice).toEqual({
      type: 'tool',
      name: 'record_translation',
    });
    expect(options.timeout).toBe(3000);
  });

  it('OpenAI sends input_text parts with the JSON schema format', async () => {
    const fetchFn = fetchReturning(
      jsonResponse({
        status: 'completed',
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text: '{"en":"Pets"}' }],
          },
        ],
      }),
    );

    const data = await new OpenAiProvider('sk-test', fetchFn).extractFromText(
      textRequest,
    );

    expect(data).toEqual({ en: 'Pets' });
    expect(sentBody(fetchFn).input[0].content).toEqual([
      { type: 'input_text', text: 'Translate the category name' },
      { type: 'input_text', text: 'Mascotas' },
    ]);
    expect(sentBody(fetchFn).text.format).toEqual(
      expect.objectContaining({ type: 'json_schema' }),
    );
  });

  it('Gemini sends text parts in JSON mode', async () => {
    const fetchFn = fetchReturning(
      jsonResponse({
        candidates: [
          {
            finishReason: 'STOP',
            content: { parts: [{ text: '{"en":"Pets"}' }] },
          },
        ],
      }),
    );

    const data = await new GoogleProvider('g-test', fetchFn).extractFromText(
      textRequest,
    );

    expect(data).toEqual({ en: 'Pets' });
    expect(sentBody(fetchFn).contents[0].parts).toEqual([
      { text: 'Translate the category name' },
      { text: 'Mascotas' },
    ]);
    expect(sentBody(fetchFn).generationConfig.responseMimeType).toBe(
      'application/json',
    );
  });

  it('fails without a key', async () => {
    await expect(
      new OpenAiProvider('').extractFromText(textRequest),
    ).rejects.toThrow(AiProviderError);
  });
});
