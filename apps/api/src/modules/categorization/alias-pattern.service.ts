import { Injectable, Logger } from '@nestjs/common';
import { AiFeatureKey, AliasMatchType } from '@finnit/database';

import { PrismaService } from '../../services/prisma.service';
import {
  PrivacyLockedError,
  ValidationError,
} from '../../common/exceptions/graphql-error.exception';
import { AiModelsService } from '../ai/ai-models.service';
import {
  ALIAS_PATTERN_PROMPT,
  ALIAS_PATTERN_SCHEMA,
  MAX_PATTERN_EXAMPLES,
  aliasPatternRequest,
  heuristicPatterns,
  parseAiPattern,
  type PatternCandidate,
} from './alias-pattern';
import {
  AliasPatternSource,
  AliasPatternSuggestion,
  SuggestAliasPatternInput,
} from './dto/merchant-alias.dto';
import { coverageSql } from './merchant-alias.sql';
import { MerchantAliasesService } from './merchant-aliases.service';

const AI_TIMEOUT_MS = 20_000;
/** Tries with the AI: the second one is told what the first got wrong. */
const AI_ATTEMPTS = 2;

interface Coverage {
  ok: boolean;
  missed: string[];
  caught: string[];
}

/**
 * Proposes the pattern of an automatic name from movements the user picks:
 * the AI first (checked in Postgres against the examples, one retry), else
 * the words the examples share. Nothing is saved; the user reviews the
 * preview and creates the rule.
 */
@Injectable()
export class AliasPatternService {
  private readonly logger = new Logger(AliasPatternService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiModels: AiModelsService,
    private readonly aliases: MerchantAliasesService,
  ) {}

  async suggest(
    userId: string,
    input: SuggestAliasPatternInput,
    unlocked = false,
  ): Promise<AliasPatternSuggestion> {
    // A protected rule's movements only lend their bank text with the PIN.
    if (!unlocked) {
      const protectedRows = await this.prisma.transaction.count({
        where: {
          userId,
          id: {
            in: [
              ...input.transactionIds,
              ...(input.excludeTransactionIds ?? []),
            ],
          },
          alias: { isProtected: true },
        },
      });
      if (protectedRows > 0) throw new PrivacyLockedError();
    }
    const examples = await this.texts(userId, input.transactionIds);
    if (examples.length === 0) {
      throw new ValidationError('Those movements have no bank text');
    }
    const exclude = (
      await this.texts(userId, input.excludeTransactionIds ?? [])
    ).filter((text) => !examples.includes(text));
    const locale = await this.localeOf(userId);

    let chosen: {
      candidate: PatternCandidate;
      source: AliasPatternSource;
    } | null = null;
    let aiUnavailable = false;
    let previous:
      | { candidate: PatternCandidate; missed: string[]; caught: string[] }
      | undefined;
    for (let attempt = 0; attempt < AI_ATTEMPTS && !chosen; attempt++) {
      const candidate = await this.askAi(examples, exclude, locale, previous);
      if (candidate === 'unavailable') {
        aiUnavailable = true;
        break;
      }
      if (!candidate) continue;
      const coverage = await this.coverage(candidate, examples, exclude);
      if (coverage?.ok) {
        chosen = { candidate, source: AliasPatternSource.ai };
      } else if (coverage) {
        previous = {
          candidate,
          missed: coverage.missed,
          caught: coverage.caught,
        };
      }
    }

    let coversAll = chosen !== null;
    if (!chosen) {
      const fallbacks = heuristicPatterns(examples).map((pattern) => ({
        matchType: AliasMatchType.contains,
        pattern,
        explanation: '',
      }));
      for (const candidate of fallbacks) {
        if ((await this.coverage(candidate, examples, exclude))?.ok) {
          chosen = { candidate, source: AliasPatternSource.heuristic };
          coversAll = true;
          break;
        }
      }
      // Nothing covers everything: the first example's own fragment.
      chosen ??= {
        candidate: fallbacks[0] ?? {
          matchType: AliasMatchType.contains,
          pattern: examples[0].slice(0, 200),
          explanation: '',
        },
        source: AliasPatternSource.heuristic,
      };
    }

    const { matchType, pattern, explanation } = chosen.candidate;
    const preview = await this.aliases.preview(
      userId,
      { matchType, pattern, displayName: '' },
      null,
      unlocked,
    );
    return {
      matchType,
      pattern,
      explanation,
      source: chosen.source,
      coversAll,
      aiUnavailable,
      preview,
    };
  }

  /** The bank text (merchant, else description) of the user's movements. */
  private async texts(userId: string, ids: string[]): Promise<string[]> {
    const unique = [...new Set(ids)].slice(0, MAX_PATTERN_EXAMPLES);
    if (unique.length === 0) return [];
    const rows = await this.prisma.transaction.findMany({
      where: { id: { in: unique }, userId },
      select: { merchantName: true, description: true },
    });
    const texts = rows
      .map((row) => row.merchantName?.trim() || row.description?.trim() || '')
      .filter(Boolean);
    return [...new Set(texts)];
  }

  private async askAi(
    examples: string[],
    exclude: string[],
    locale: string,
    previous?: {
      candidate: PatternCandidate;
      missed: string[];
      caught: string[];
    },
  ): Promise<PatternCandidate | null | 'unavailable'> {
    try {
      const { data } = await this.aiModels.extractFromText(
        {
          prompt: ALIAS_PATTERN_PROMPT,
          text: aliasPatternRequest(examples, exclude, locale, previous),
          schema: ALIAS_PATTERN_SCHEMA,
          schemaName: 'alias_pattern',
          timeoutMs: AI_TIMEOUT_MS,
        },
        { feature: AiFeatureKey.alias_pattern },
      );
      return parseAiPattern(data);
    } catch (error) {
      this.logger.warn(
        `Alias pattern AI unavailable: ${(error as Error).message}`,
      );
      return 'unavailable';
    }
  }

  /** Whether the pattern matches every example and none of the excluded (null: invalid regex). */
  private async coverage(
    candidate: PatternCandidate,
    examples: string[],
    exclude: string[],
  ): Promise<Coverage | null> {
    try {
      const rows = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = '2s'`);
        return tx.$queryRaw<{ text: string; ok: boolean }[]>(
          coverageSql(candidate.matchType, candidate.pattern, [
            ...examples,
            ...exclude,
          ]),
        );
      });
      const ok = new Map(rows.map((row) => [row.text, row.ok]));
      const missed = examples.filter((text) => !ok.get(text));
      const caught = exclude.filter((text) => ok.get(text));
      return { ok: missed.length === 0 && caught.length === 0, missed, caught };
    } catch {
      return null;
    }
  }

  private async localeOf(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { locale: true },
    });
    return user?.locale ?? 'es';
  }
}
