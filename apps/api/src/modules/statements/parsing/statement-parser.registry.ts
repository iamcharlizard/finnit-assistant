import { Injectable, Logger } from '@nestjs/common';
import { AiModelsService } from '../../ai/ai-models.service';
import { OcrClient, OcrError } from '../../ocr/ocr.client';
import { AiStatementParser } from './ai-statement.parser';
import { BanamexCreditCardParser } from './banamex-credit-card.parser';
import {
  ParsedStatement,
  StatementParseError,
  StatementParser,
} from './parsed-statement';
import { extractPdfText } from './pdf-text';
import { checkStatement } from './statement-validation';

export interface ParseResult {
  parser: string;
  statement: ParsedStatement;
}

/** Below this many characters per page the PDF is treated as scanned. */
export const SCANNED_TEXT_PER_PAGE = 200;
/** Pages sent to the OCR service at most (statements are a few pages). */
// Same as the OCR service default; about 7 s per page on the server.
export const OCR_MAX_PAGES = 10;
/** Suffix of the parser id when the text came from OCR, e.g. banamex_v1+ocr. */
export const OCR_SUFFIX = '+ocr';

/**
 * Picks a parser for a statement: local bank parsers first (the statement
 * never leaves the server), the AI model catalog as the fallback.
 *
 * 1. Text from the PDF's text layer; a scanned PDF (little text per page)
 *    goes through the internal OCR service and its lines feed the same
 *    local parsers (parser id "<id>+ocr").
 * 2. A local parser that does not balance (checkStatement) is compared with
 *    the AI (statement_parsing feature): the one that balances wins, else
 *    the one with the smaller |difference|.
 *
 * Forced parser ids for reprocessing (used as they come, no comparison):
 * - a local parser id, e.g. "banamex_v1";
 * - "ai": the AI catalog (default model, then the next active ones);
 * - "ai:<AiModel id>": one specific AI model.
 */
@Injectable()
export class StatementParserRegistry {
  private readonly logger = new Logger(StatementParserRegistry.name);
  private readonly localParsers: StatementParser[] = [
    new BanamexCreditCardParser(),
  ];
  private readonly ai: AiStatementParser;

  constructor(
    aiModels: AiModelsService,
    private readonly ocr: OcrClient,
  ) {
    this.ai = new AiStatementParser(aiModels);
  }

  isKnownParser(parserId: string): boolean {
    const id = parserId.endsWith(OCR_SUFFIX)
      ? parserId.slice(0, -OCR_SUFFIX.length)
      : parserId;
    return (
      id === AiStatementParser.ID ||
      id.startsWith(`${AiStatementParser.ID}:`) ||
      this.localParsers.some((p) => p.id === id)
    );
  }

  get localParserIds(): string[] {
    return this.localParsers.map((p) => p.id);
  }

  async parse(pdf: Buffer, parserId?: string): Promise<ParseResult> {
    if (parserId?.startsWith(AiStatementParser.ID)) {
      const aiModelId = parserId.split(':')[1] || undefined;
      return this.parseWithAi(pdf, aiModelId);
    }

    const forcedId = parserId?.endsWith(OCR_SUFFIX)
      ? parserId.slice(0, -OCR_SUFFIX.length)
      : parserId;
    const { text, viaOcr } = await this.readText(pdf);
    const local = forcedId
      ? this.localParsers.find((p) => p.id === forcedId)
      : this.localParsers.find((p) => p.canParse(text));
    if (forcedId && !local) {
      throw new StatementParseError(`Unknown parser: ${parserId}`);
    }
    if (!local) return this.parseWithAi(pdf);

    const id = viaOcr ? `${local.id}${OCR_SUFFIX}` : local.id;
    if (forcedId) {
      return { parser: id, statement: await local.parse({ text, pdf }) };
    }

    let localResult: ParseResult | undefined;
    try {
      localResult = { parser: id, statement: await local.parse({ text, pdf }) };
    } catch (error) {
      if (!(error instanceof StatementParseError)) throw error;
      this.logger.warn(`${id} could not parse the statement: ${error.message}`);
    }
    if (localResult && checkStatement(localResult.statement).balanced) {
      return localResult;
    }

    // The local result is missing or does not balance: ask the AI.
    let aiResult: ParseResult | undefined;
    try {
      aiResult = await this.parseWithAi(pdf);
    } catch (error) {
      if (!localResult) throw error;
      if (!(error instanceof StatementParseError)) throw error;
    }
    if (!aiResult) return localResult!;
    if (!localResult) return aiResult;
    return absDifference(aiResult) < absDifference(localResult)
      ? aiResult
      : localResult;
  }

  /**
   * The PDF's text layer, or the OCR of its pages when the layer is (almost)
   * empty. Without the OCR service the text layer is used as is.
   */
  private async readText(
    pdf: Buffer,
  ): Promise<{ text: string; viaOcr: boolean }> {
    const text = await extractPdfText(pdf).catch(() => '');
    if (!isScanned(text) || !this.ocr.isConfigured) {
      return { text, viaOcr: false };
    }
    try {
      const { pages } = await this.ocr.pdf(pdf, OCR_MAX_PAGES);
      const ocrText = pages
        .map((page) => page.lines.map((line) => line.text).join('\n'))
        .join('\n\f\n');
      return ocrText.trim()
        ? { text: ocrText, viaOcr: true }
        : { text, viaOcr: false };
    } catch (error) {
      if (!(error instanceof OcrError)) throw error;
      this.logger.warn(`OCR of a scanned statement failed: ${error.message}`);
      return { text, viaOcr: false };
    }
  }

  private async parseWithAi(
    pdf: Buffer,
    aiModelId?: string,
  ): Promise<ParseResult> {
    const { parserId, statement } = await this.ai.parse(pdf, aiModelId);
    return { parser: parserId, statement };
  }
}

/** Few characters per page (pages are separated by form feeds). */
export function isScanned(text: string): boolean {
  const pages = text.split('\f').length;
  const characters = text.replace(/\s/g, '').length;
  return characters / pages < SCANNED_TEXT_PER_PAGE;
}

/** |difference| of the balance check; unknown counts as worst. */
function absDifference(result: ParseResult): number {
  const { difference } = checkStatement(result.statement);
  return difference === null ? Number.POSITIVE_INFINITY : Math.abs(difference);
}
