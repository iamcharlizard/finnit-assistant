import type Anthropic from '@anthropic-ai/sdk';
import { ImportedLineKind } from '@finnit/database';
import { ClaudeStatementParser, sanitize } from './claude-statement.parser';
import { StatementParseError } from './parsed-statement';

describe('ClaudeStatementParser', () => {
  const pdf = Buffer.from('%PDF-1.7 test');

  const clientReturning = (response: Partial<Anthropic.Messages.Message>) => {
    const create = jest
      .fn<Promise<unknown>, [Anthropic.Messages.MessageCreateParams]>()
      .mockResolvedValue(response);
    return {
      client: { messages: { create } } as unknown as Anthropic,
      create,
    };
  };

  it('is disabled without an API key', async () => {
    const parser = new ClaudeStatementParser('');
    expect(parser.isEnabled).toBe(false);
    expect(parser.canParse()).toBe(false);
    await expect(parser.parse({ pdf })).rejects.toThrow(StatementParseError);
  });

  it('sends the PDF as a document and forces the extraction tool', async () => {
    const { client, create } = clientReturning({
      stop_reason: 'tool_use',
      content: [
        {
          type: 'tool_use',
          id: 'tool-1',
          name: 'record_statement',
          input: {
            currency: 'mxn',
            statementBalance: 1349,
            lines: [
              {
                date: '2026-09-10',
                description: 'NETFLIX',
                amount: 299,
                kind: 'charge',
              },
            ],
          },
        } as Anthropic.Messages.ToolUseBlock,
      ],
    });
    const parser = new ClaudeStatementParser(undefined, client);

    const result = await parser.parse({ pdf });

    const request = create.mock.calls[0][0];
    expect(request.tool_choice).toEqual({
      type: 'tool',
      name: 'record_statement',
    });
    const content = request.messages[0]
      .content as Anthropic.Messages.ContentBlockParam[];
    expect(content[0]).toEqual({
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: pdf.toString('base64'),
      },
    });
    expect(result.currency).toBe('MXN');
    expect(result.lines).toHaveLength(1);
  });

  it('fails when the answer was cut off', async () => {
    const { client } = clientReturning({
      stop_reason: 'max_tokens',
      content: [],
    });
    await expect(
      new ClaudeStatementParser(undefined, client).parse({ pdf }),
    ).rejects.toThrow('too long');
  });

  it('fails when there is no tool call', async () => {
    const { client } = clientReturning({
      stop_reason: 'end_turn',
      content: [],
    });
    await expect(
      new ClaudeStatementParser(undefined, client).parse({ pdf }),
    ).rejects.toThrow('no data');
  });
});

describe('sanitize', () => {
  it('keeps well-formed fields and drops malformed lines', () => {
    const result = sanitize({
      currency: 'usd',
      cardLast4: '**** 1234',
      statementDate: '15-sep-2026',
      paymentDueDate: 'not a date',
      statementBalance: 1349.5,
      minimumPayment: '200',
      lines: [
        {
          date: '2026-09-10',
          description: 'NETFLIX',
          amount: -299,
          kind: 'charge',
        },
        {
          date: '2026-09-11',
          description: 'MSI',
          amount: 500,
          kind: 'installment',
          installmentNumber: 2,
          installmentTotal: 6,
        },
        { date: 'bad', description: 'X', amount: 1, kind: 'charge' },
        { date: '2026-09-12', description: 'X', amount: 1, kind: 'gift' },
        { date: '2026-09-13', description: '', amount: 1, kind: 'charge' },
        null,
      ],
    });

    expect(result).toEqual(
      expect.objectContaining({
        currency: 'USD',
        cardLast4: '1234',
        statementDate: '2026-09-15',
        paymentDueDate: undefined,
        statementBalance: 1349.5,
        minimumPayment: undefined,
      }),
    );
    expect(result.lines).toEqual([
      expect.objectContaining({ amount: 299, kind: ImportedLineKind.charge }),
      expect.objectContaining({
        kind: ImportedLineKind.installment,
        installmentNumber: 2,
        installmentTotal: 6,
      }),
    ]);
  });

  it('defaults to MXN for an invalid currency', () => {
    expect(sanitize({ currency: 'pesos', lines: [] }).currency).toBe('MXN');
  });
});
