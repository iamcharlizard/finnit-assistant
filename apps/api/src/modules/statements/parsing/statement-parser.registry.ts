import { Injectable } from '@nestjs/common';
import { AiModelsService } from '../../ai/ai-models.service';
import { AiStatementParser } from './ai-statement.parser';
import { BanamexCreditCardParser } from './banamex-credit-card.parser';
import {
  ParsedStatement,
  StatementParseError,
  StatementParser,
} from './parsed-statement';
import { extractPdfText } from './pdf-text';

export interface ParseResult {
  parser: string;
  statement: ParsedStatement;
}

/**
 * Picks a parser for a statement: local bank parsers first (the statement
 * never leaves the server), the AI model catalog as the fallback.
 *
 * Forced parser ids for reprocessing:
 * - a local parser id, e.g. "banamex_v1";
 * - "ai": the AI catalog (default model, then the next active ones);
 * - "ai:<AiModel id>": one specific AI model.
 */
@Injectable()
export class StatementParserRegistry {
  private readonly localParsers: StatementParser[] = [
    new BanamexCreditCardParser(),
  ];
  private readonly ai: AiStatementParser;

  constructor(aiModels: AiModelsService) {
    this.ai = new AiStatementParser(aiModels);
  }

  isKnownParser(parserId: string): boolean {
    return (
      parserId === AiStatementParser.ID ||
      parserId.startsWith(`${AiStatementParser.ID}:`) ||
      this.localParsers.some((p) => p.id === parserId)
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

    const text = await extractPdfText(pdf).catch(() => '');
    const local = parserId
      ? this.localParsers.find((p) => p.id === parserId)
      : this.localParsers.find((p) => p.canParse(text));
    if (parserId && !local) {
      throw new StatementParseError(`Unknown parser: ${parserId}`);
    }
    if (local) {
      return { parser: local.id, statement: await local.parse({ text, pdf }) };
    }
    return this.parseWithAi(pdf);
  }

  private async parseWithAi(
    pdf: Buffer,
    aiModelId?: string,
  ): Promise<ParseResult> {
    const { parserId, statement } = await this.ai.parse(pdf, aiModelId);
    return { parser: parserId, statement };
  }
}
