import { mockDeep } from 'jest-mock-extended';
import { AiProvider, ImportedLineKind } from '@finnit/database';
import {
  AiModelsService,
  NoUsableAiModelError,
} from '../../ai/ai-models.service';
import { AiProviderError } from '../../ai/providers/ai-provider';
import { AiStatementParser, sanitize } from './ai-statement.parser';
import { StatementParseError } from './parsed-statement';

describe('AiStatementParser', () => {
  const pdf = Buffer.from('%PDF-1.7 test');
  const aiModels = mockDeep<AiModelsService>();
  const parser = new AiStatementParser(aiModels);

  beforeEach(() => jest.resetAllMocks());

  it('asks the catalog for structured data and records the model used', async () => {
    aiModels.extractFromPdf.mockResolvedValue({
      model: { provider: AiProvider.openai, modelId: 'gpt-5-mini' } as never,
      data: {
        currency: 'mxn',
        lines: [
          {
            date: '2026-09-10',
            description: 'NETFLIX',
            amount: 299,
            kind: 'charge',
          },
        ],
      },
    });

    const result = await parser.parse(pdf, 'model-uuid');

    expect(aiModels.extractFromPdf).toHaveBeenCalledWith(
      expect.objectContaining({ pdf, schemaName: 'record_statement' }),
      'model-uuid',
    );
    expect(result.parserId).toBe('ai:openai/gpt-5-mini');
    expect(result.statement.currency).toBe('MXN');
    expect(result.statement.lines).toHaveLength(1);
  });

  it('reports when no model is usable', async () => {
    aiModels.extractFromPdf.mockRejectedValue(
      new NoUsableAiModelError('No active AI model'),
    );
    await expect(parser.parse(pdf)).rejects.toThrow(
      new StatementParseError('No active AI model'),
    );
  });

  it('hides provider details when every model fails', async () => {
    aiModels.extractFromPdf.mockRejectedValue(
      new AiProviderError(AiProvider.google, 'HTTP 500: internal'),
    );
    await expect(parser.parse(pdf)).rejects.toThrow(
      new StatementParseError('AI extraction failed'),
    );
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
