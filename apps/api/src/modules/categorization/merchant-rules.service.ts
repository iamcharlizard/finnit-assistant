import { Injectable } from '@nestjs/common';
import { Prisma } from '@finnit/database';
import { PrismaService } from '../../services/prisma.service';
import { NotFoundError } from '../../common/exceptions/graphql-error.exception';
import {
  merchantKey,
  normalizeMerchant,
} from '../recurring-expenses/suggestions/detect';
import { mapCategory } from '../transactions/transaction.mapper';
import { MerchantRule } from './dto/merchant-rule.dto';

type Db = Prisma.TransactionClient | PrismaService;

/** Keys shorter than this are too generic to learn from. */
const MIN_KEY_LENGTH = 3;
const MAX_PATTERN_LENGTH = 200;

/** The text a rule looks at: merchantName, else description. */
export function ruleText(row: {
  merchantName?: string | null;
  description?: string | null;
}): string | null {
  return row.merchantName?.trim() || row.description?.trim() || null;
}

/**
 * Normalized merchant stored as the rule's pattern ("OXXO GAS"), using the
 * same normalization as the recurring-payment detection.
 */
export function rulePattern(text: string | null | undefined): string | null {
  if (!text) return null;
  const pattern = normalizeMerchant(text).slice(0, MAX_PATTERN_LENGTH).trim();
  return merchantKey(pattern).length >= MIN_KEY_LENGTH ? pattern : null;
}

/** Lookup key: the pattern without spaces (banks drop spaces at random). */
export function ruleKey(text: string | null | undefined): string | null {
  const pattern = rulePattern(text);
  return pattern ? merchantKey(pattern) : null;
}

export interface RuleMatch {
  ruleId: string;
  categoryId: string;
}

/**
 * Merchant memory (feature 16): merchant → category rules learned from the
 * user's corrections and accepted suggestions, applied to new movements
 * before any frequency guess or AI.
 */
@Injectable()
export class MerchantRulesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<MerchantRule[]> {
    const rows = await this.prisma.merchantRule.findMany({
      where: { userId },
      include: { category: true },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    });
    return rows.map((row) => ({
      id: row.id,
      pattern: row.pattern,
      category: mapCategory(row.category),
      hits: row.hits,
      updatedAt: row.updatedAt,
    }));
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const { count } = await this.prisma.merchantRule.deleteMany({
      where: { id, userId },
    });
    if (count === 0) throw new NotFoundError('Rule not found');
    return true;
  }

  /** The rule matching each text (keyed by the text itself), if any. */
  async match(
    userId: string,
    texts: (string | null | undefined)[],
    db: Db = this.prisma,
  ): Promise<Map<string, RuleMatch>> {
    const result = new Map<string, RuleMatch>();
    const keyed = texts
      .filter((text): text is string => Boolean(text))
      .map((text) => [text, ruleKey(text)] as const)
      .filter((entry): entry is readonly [string, string] => !!entry[1]);
    if (keyed.length === 0) return result;

    const byKey = await this.rulesByKey(userId, db);
    for (const [text, key] of keyed) {
      const rule = byKey.get(key);
      if (rule)
        result.set(text, { ruleId: rule.id, categoryId: rule.categoryId });
    }
    return result;
  }

  /** Category of the rule matching one text, if any. */
  async categoryFor(
    userId: string,
    text: string | null | undefined,
    db: Db = this.prisma,
  ): Promise<string | null> {
    if (!text) return null;
    return (await this.match(userId, [text], db)).get(text)?.categoryId ?? null;
  }

  /**
   * Creates or updates one rule per distinct merchant: the category is the
   * one the user chose (the last one wins) and hits grow by the number of
   * movements confirmed.
   */
  async learn(
    db: Db,
    userId: string,
    entries: { text: string | null | undefined; categoryId: string }[],
  ): Promise<number> {
    const groups = new Map<
      string,
      { pattern: string; categoryId: string; hits: number }
    >();
    for (const entry of entries) {
      const pattern = rulePattern(entry.text);
      if (!pattern) continue;
      const key = merchantKey(pattern);
      const group = groups.get(key);
      groups.set(key, {
        pattern: group?.pattern ?? pattern,
        categoryId: entry.categoryId,
        hits: (group?.hits ?? 0) + 1,
      });
    }
    if (groups.size === 0) return 0;

    const existing = await this.rulesByKey(userId, db);
    for (const [key, group] of groups) {
      const rule = existing.get(key);
      if (rule) {
        await db.merchantRule.update({
          where: { id: rule.id },
          data: {
            categoryId: group.categoryId,
            hits: { increment: group.hits },
          },
        });
      } else {
        await db.merchantRule.upsert({
          where: { userId_pattern: { userId, pattern: group.pattern } },
          create: {
            userId,
            pattern: group.pattern,
            categoryId: group.categoryId,
            hits: group.hits,
          },
          update: {
            categoryId: group.categoryId,
            hits: { increment: group.hits },
          },
        });
      }
    }
    return groups.size;
  }

  private async rulesByKey(
    userId: string,
    db: Db,
  ): Promise<Map<string, { id: string; categoryId: string }>> {
    const rules = await db.merchantRule.findMany({
      where: { userId },
      select: { id: true, pattern: true, categoryId: true },
      orderBy: [{ updatedAt: 'desc' }],
    });
    const byKey = new Map<string, { id: string; categoryId: string }>();
    for (const rule of rules) {
      const key = merchantKey(rule.pattern);
      if (!byKey.has(key)) byKey.set(key, rule);
    }
    return byKey;
  }
}
