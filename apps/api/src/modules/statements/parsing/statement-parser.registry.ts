import { Injectable } from '@nestjs/common';
import { BanamexCreditCardParser } from './banamex-credit-card.parser';
import { ClaudeStatementParser } from './claude-statement.parser';
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
 * never leaves the server), Claude as the fallback for unknown formats.
 */
@Injectable()
export class StatementParserRegistry {
  private readonly localParsers: StatementParser[] = [
    new BanamexCreditCardParser(),
  ];
  private readonly fallback = new ClaudeStatementParser();

  /** Ids accepted by `parse(…, parserId)`. */
  get availableParsers(): string[] {
    return [
      ...this.localParsers.map((p) => p.id),
      ...(this.fallback.isEnabled ? [this.fallback.id] : []),
    ];
  }

  async parse(pdf: Buffer, parserId?: string): Promise<ParseResult> {
    const text = await extractPdfText(pdf).catch(() => '');
    const candidates = [...this.localParsers, this.fallback];

    const parser = parserId
      ? candidates.find((p) => p.id === parserId)
      : candidates.find((p) => p.canParse(text));
    if (!parser) {
      throw new StatementParseError(
        parserId
          ? `Unknown or disabled parser: ${parserId}`
          : 'Unsupported statement format',
      );
    }
    return { parser: parser.id, statement: await parser.parse({ text, pdf }) };
  }
}
