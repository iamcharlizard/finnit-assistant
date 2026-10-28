import { ImportedLineKind } from '@finnit/database';
import { AiModelsService } from '../../ai/ai-models.service';
import { OcrClient, OcrUnavailableError } from '../../ocr/ocr.client';
import { AiStatementParser } from './ai-statement.parser';
import { BanamexCreditCardParser } from './banamex-credit-card.parser';
import { ParsedStatement, StatementParseError } from './parsed-statement';
import { extractPdfText } from './pdf-text';
import {
  isScanned,
  StatementParserRegistry,
  OCR_MAX_PAGES,
} from './statement-parser.registry';

jest.mock('./pdf-text', () => ({ extractPdfText: jest.fn() }));

const pdf = Buffer.from('%PDF-1.7');
const textMock = extractPdfText as jest.MockedFunction<typeof extractPdfText>;

/** previous 100 + charges = balance; `missing` makes it not balance. */
const statement = (missing = 0): ParsedStatement => ({
  currency: 'MXN',
  previousBalance: 100,
  statementBalance: 150 + missing,
  lines: [
    {
      date: '2026-09-01',
      description: 'DEMO',
      amount: 50,
      kind: ImportedLineKind.charge,
    },
  ],
});

const digitalText = `BANAMEX ${'x'.repeat(500)}`;

describe('StatementParserRegistry', () => {
  let registry: StatementParserRegistry;
  let ocr: { isConfigured: boolean; pdf: jest.Mock };
  let canParse: jest.SpyInstance;
  let localParse: jest.SpyInstance;
  let aiParse: jest.SpyInstance;

  beforeEach(() => {
    ocr = { isConfigured: true, pdf: jest.fn() };
    registry = new StatementParserRegistry(
      {} as AiModelsService,
      ocr as unknown as OcrClient,
    );
    jest.spyOn(registry['logger'], 'warn').mockImplementation(() => undefined);
    canParse = jest
      .spyOn(BanamexCreditCardParser.prototype, 'canParse')
      .mockImplementation((text: string) => text.startsWith('BANAMEX'));
    localParse = jest
      .spyOn(BanamexCreditCardParser.prototype, 'parse')
      .mockResolvedValue(statement());
    aiParse = jest
      .spyOn(AiStatementParser.prototype, 'parse')
      .mockResolvedValue({
        parserId: 'ai:anthropic/demo',
        statement: statement(),
      });
  });

  afterEach(() => jest.restoreAllMocks());

  it('uses the local parser on a digital PDF that balances (no OCR, no AI)', async () => {
    textMock.mockResolvedValue(digitalText);
    const result = await registry.parse(pdf);
    expect(result.parser).toBe('banamex_v1');
    expect(ocr.pdf).not.toHaveBeenCalled();
    expect(aiParse).not.toHaveBeenCalled();
  });

  it('runs OCR on a scanned PDF and feeds the lines to the local parsers', async () => {
    textMock.mockResolvedValue('\n\f\n\n\f\n');
    ocr.pdf.mockResolvedValue({
      pages: [
        {
          page: 1,
          lines: [{ text: 'BANAMEX' }, { text: 'Fecha de corte' }],
          qr: [],
        },
        { page: 2, lines: [{ text: 'MOVIMIENTOS' }], qr: [] },
      ],
    });
    const result = await registry.parse(pdf);
    expect(ocr.pdf).toHaveBeenCalledWith(pdf, OCR_MAX_PAGES);
    expect(result.parser).toBe('banamex_v1+ocr');
    expect(localParse).toHaveBeenCalledWith({
      text: 'BANAMEX\nFecha de corte\n\f\nMOVIMIENTOS',
      pdf,
    });
  });

  it('falls back to the AI when the scanned PDF cannot be OCRed', async () => {
    textMock.mockResolvedValue('');
    ocr.pdf.mockRejectedValue(new OcrUnavailableError('down'));
    const result = await registry.parse(pdf);
    expect(result.parser).toBe('ai:anthropic/demo');
  });

  it('skips OCR when the service is not configured', async () => {
    textMock.mockResolvedValue('');
    ocr.isConfigured = false;
    await registry.parse(pdf);
    expect(ocr.pdf).not.toHaveBeenCalled();
    expect(aiParse).toHaveBeenCalled();
  });

  it('keeps the AI result when the local one does not balance and the AI does', async () => {
    textMock.mockResolvedValue(digitalText);
    localParse.mockResolvedValue(statement(30));
    const result = await registry.parse(pdf);
    expect(aiParse).toHaveBeenCalled();
    expect(result.parser).toBe('ai:anthropic/demo');
  });

  it('keeps the smaller |difference| when neither balances', async () => {
    textMock.mockResolvedValue(digitalText);
    localParse.mockResolvedValue(statement(5));
    aiParse.mockResolvedValue({ parserId: 'ai:x', statement: statement(-40) });
    expect((await registry.parse(pdf)).parser).toBe('banamex_v1');

    aiParse.mockResolvedValue({ parserId: 'ai:x', statement: statement(2) });
    expect((await registry.parse(pdf)).parser).toBe('ai:x');
  });

  it('keeps the unbalanced local result when the AI is off', async () => {
    textMock.mockResolvedValue(digitalText);
    localParse.mockResolvedValue(statement(30));
    aiParse.mockRejectedValue(new StatementParseError('feature off'));
    expect((await registry.parse(pdf)).parser).toBe('banamex_v1');
  });

  it('tries the AI when the local parser throws', async () => {
    textMock.mockResolvedValue(digitalText);
    localParse.mockRejectedValue(new StatementParseError('layout changed'));
    expect((await registry.parse(pdf)).parser).toBe('ai:anthropic/demo');
  });

  it('a forced local parser is used as is, even unbalanced', async () => {
    textMock.mockResolvedValue(digitalText);
    localParse.mockResolvedValue(statement(30));
    expect((await registry.parse(pdf, 'banamex_v1')).parser).toBe('banamex_v1');
    expect(aiParse).not.toHaveBeenCalled();
    expect(canParse).not.toHaveBeenCalled();
  });

  it('knows the +ocr variants of local parsers', () => {
    expect(registry.isKnownParser('banamex_v1+ocr')).toBe(true);
    expect(registry.isKnownParser('ai:123')).toBe(true);
    expect(registry.isKnownParser('nope')).toBe(false);
  });
});

describe('isScanned', () => {
  it('is true for little text per page', () => {
    expect(isScanned('')).toBe(true);
    expect(isScanned(`${'a'.repeat(300)}\n\f\n${'b'.repeat(50)}`)).toBe(true);
    expect(isScanned(`${'a'.repeat(300)}\n\f\n${'b'.repeat(300)}`)).toBe(false);
  });
});
