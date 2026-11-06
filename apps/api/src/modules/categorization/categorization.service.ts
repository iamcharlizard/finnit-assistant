import { Injectable, Logger } from '@nestjs/common';
import {
  AiFeatureKey,
  CategorySource,
  Prisma,
  TransactionType,
} from '@finnit/database';
import { PrismaService } from '../../services/prisma.service';
import {
  NotFoundError,
  ValidationError,
} from '../../common/exceptions/graphql-error.exception';
import { Transaction } from '../../common/types/models/transaction.model';
import { AiModelsService } from '../ai/ai-models.service';
import { JsonSchema } from '../ai/providers/ai-provider';
import {
  TRANSACTION_PRESENTATION_INCLUDE,
  mapTransaction,
  presentTransaction,
} from '../transactions/transaction.mapper';
import {
  MerchantRulesService,
  ruleKey,
  ruleText,
} from './merchant-rules.service';
import { MerchantAliasesService } from './merchant-aliases.service';
import { buildHistoryIndex, categoryFromHistory } from './history-category';
import { addDays, localToday } from '../../common/utils/local-date.util';
import {
  visibleCategoryWhere,
  pickableCategoryWhere,
} from '../categories/category-scope';

export const MAX_CATEGORIZE_IDS = 500;
export const MAX_SUGGEST_IDS = 100;
export const AI_TIMEOUT_MS = 20_000;
/** Past categorizations considered when categorizing on our own. */
const HISTORY_DAYS = 365;
/** Uncategorized movements looked at per run (newest first). */
const AUTO_CATEGORIZE_LIMIT = 2_000;
/** Movements sent to the AI in one "Clasificar automáticamente" (in batches of MAX_SUGGEST_IDS). */
export const AI_SUGGEST_PER_RUN = 300;
const HISTORY_SAMPLE_LIMIT = 5_000;

/** Movements waiting for a category, leaving out possible transfers. */
export function uncategorizedWhere(
  userId: string,
): Prisma.TransactionWhereInput {
  return {
    userId,
    categoryId: null,
    type: { in: CATEGORIZABLE_TYPES },
    OR: [
      { transferSuggestion: { is: null } },
      { transferSuggestion: { status: { not: 'pending' } } },
    ],
  };
}

/** Movement types that take a category. */
const CATEGORIZABLE_TYPES: TransactionType[] = [
  TransactionType.expense,
  TransactionType.income,
];

const AI_PROMPT = `You categorize the bank movements of a Mexican user for a personal-finance app.
The input is JSON: "movements" (each with a ref, the merchant or name as shown to the user, the amount and its type: expense or income) and "categories" (the user's categories: ref and name, "Parent > Child" for subcategories).
For every movement return:
- ref: the movement's ref, unchanged.
- categoryRef: the ref of the best matching category from the list, or "" when none fits. Prefer subcategories. Expenses go to spending categories and income to income categories.`;

const AI_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ref: { type: 'string' },
          categoryRef: {
            type: 'string',
            description: 'Category ref from the list; empty when none fits',
          },
        },
        required: ['ref', 'categoryRef'],
      },
    },
  },
  required: ['items'],
};

const listInclude = {
  account: true,
  category: true,
  attachments: true,
  ...TRANSACTION_PRESENTATION_INCLUDE,
} satisfies Prisma.TransactionInclude;

type ListRow = Prisma.TransactionGetPayload<{ include: typeof listInclude }>;

type CategoryRow = Prisma.CategoryGetPayload<{
  include: { translations: { select: { locale: true; name: true } } };
}>;

/**
 * Bulk categorization of movements (feature 16): manual moves that teach
 * merchant rules, and pending suggestions (rules first, then one AI batch)
 * the user accepts or rejects.
 */
@Injectable()
export class CategorizationService {
  private readonly logger = new Logger(CategorizationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rules: MerchantRulesService,
    private readonly aiModels: AiModelsService,
    private readonly aliases: MerchantAliasesService,
  ) {}

  /**
   * Gives a category to the movements that have none, from what the user
   * did before: their merchant rules, their aliases' categories, then the
   * category they gave the same merchant in the last year (when it is
   * clear). Never uses AI. Returns how many were categorized and how many
   * are still waiting.
   */
  async autoCategorize(
    userId: string,
  ): Promise<{ categorized: number; remaining: number }> {
    const where = uncategorizedWhere(userId);
    let pending = await this.prisma.transaction.findMany({
      where,
      select: { id: true, type: true, merchantName: true, description: true },
      orderBy: { txnDate: 'desc' },
      take: AUTO_CATEGORIZE_LIMIT,
    });
    let categorized = 0;

    // 1. Merchant rules.
    if (pending.length > 0) {
      const matches = await this.rules.match(
        userId,
        pending.map((row) => ruleText(row)),
      );
      const byCategory = new Map<string, string[]>();
      for (const row of pending) {
        const text = ruleText(row);
        const match = text ? matches.get(text) : undefined;
        if (!match) continue;
        byCategory.set(match.categoryId, [
          ...(byCategory.get(match.categoryId) ?? []),
          row.id,
        ]);
      }
      categorized += await this.assign(byCategory);
    }

    // 2. Aliases with a category (they only fill an empty one).
    pending = await this.stillUncategorized(
      pending.map((row) => row.id),
      pending,
    );
    if (pending.length > 0) {
      await this.aliases.applyTo(
        userId,
        pending.map((row) => row.id),
      );
      const before = pending.length;
      pending = await this.stillUncategorized(
        pending.map((row) => row.id),
        pending,
      );
      categorized += before - pending.length;
    }

    // 3. The category the user gave the same merchant before.
    if (pending.length > 0) {
      const samples = await this.prisma.transaction.findMany({
        where: {
          userId,
          categoryId: { not: null },
          type: { in: CATEGORIZABLE_TYPES },
          txnDate: { gte: addDays(localToday(), -HISTORY_DAYS) },
          OR: [
            { categorySource: null },
            {
              categorySource: {
                in: [CategorySource.manual, CategorySource.rule],
              },
            },
          ],
        },
        select: {
          type: true,
          merchantName: true,
          description: true,
          categoryId: true,
        },
        orderBy: { txnDate: 'desc' },
        take: HISTORY_SAMPLE_LIMIT,
      });
      const index = buildHistoryIndex(
        samples.flatMap((row) => {
          const key = ruleKey(ruleText(row));
          return key && row.categoryId
            ? [{ key, type: row.type, categoryId: row.categoryId }]
            : [];
        }),
      );
      const byCategory = new Map<string, string[]>();
      for (const row of pending) {
        const categoryId = categoryFromHistory(
          index,
          row.type,
          ruleKey(ruleText(row)),
        );
        if (!categoryId) continue;
        byCategory.set(categoryId, [
          ...(byCategory.get(categoryId) ?? []),
          row.id,
        ]);
      }
      categorized += await this.assign(byCategory);
    }

    const remaining = await this.prisma.transaction.count({ where });
    return { categorized, remaining };
  }

  /** How many movements wait for a category (possible transfers apart). */
  uncategorizedCount(userId: string): Promise<number> {
    return this.prisma.transaction.count({ where: uncategorizedWhere(userId) });
  }

  /** Sets each group's category, only where there is none yet. */
  private async assign(byCategory: Map<string, string[]>): Promise<number> {
    let count = 0;
    for (const [categoryId, ids] of byCategory) {
      const result = await this.prisma.transaction.updateMany({
        where: { id: { in: ids }, categoryId: null },
        data: {
          categoryId,
          categorySource: CategorySource.rule,
          suggestedCategoryId: null,
          suggestedBy: null,
        },
      });
      count += result.count;
    }
    return count;
  }

  private async stillUncategorized<T extends { id: string }>(
    ids: string[],
    rows: T[],
  ): Promise<T[]> {
    if (ids.length === 0) return [];
    const left = await this.prisma.transaction.findMany({
      where: { id: { in: ids }, categoryId: null },
      select: { id: true },
    });
    const keep = new Set(left.map((row) => row.id));
    return rows.filter((row) => keep.has(row.id));
  }

  /** Moves the user's movements to a category; returns how many changed. */
  async categorize(
    userId: string,
    ids: string[],
    categoryId: string,
    createRule = true,
  ): Promise<number> {
    const unique = this.checkIds(ids, MAX_CATEGORIZE_IDS);
    const category = await this.prisma.category.findFirst({
      where: {
        id: categoryId,
        ...visibleCategoryWhere(userId),
      },
      select: { id: true },
    });
    if (!category) throw new NotFoundError('Category not found');

    return this.prisma.$transaction(
      async (tx) => {
        const rows = await tx.transaction.findMany({
          where: { id: { in: unique }, userId },
          select: { id: true, merchantName: true, description: true },
        });
        if (rows.length === 0) return 0;
        const { count } = await tx.transaction.updateMany({
          where: { id: { in: rows.map((row) => row.id) }, userId },
          data: {
            categoryId,
            categorySource: CategorySource.manual,
            suggestedCategoryId: null,
            suggestedBy: null,
          },
        });
        if (createRule) {
          await this.rules.learn(
            tx,
            userId,
            rows.map((row) => ({ text: ruleText(row), categoryId })),
          );
        }
        return count;
      },
      { timeout: 20_000 },
    );
  }

  /**
   * Proposes a category for the given uncategorized movements: merchant
   * rules first, the rest in one AI call. Suggestions stay pending until
   * accepted. Without AI (off, no model, error) only rule suggestions are
   * stored; it never fails because of the AI.
   */
  async suggest(userId: string, ids: string[]): Promise<Transaction[]> {
    const unique = this.checkIds(ids, MAX_SUGGEST_IDS);
    const rows = await this.load(userId, unique);
    const candidates = rows.filter(
      (row) => !row.categoryId && CATEGORIZABLE_TYPES.includes(row.type),
    );

    const suggestions = new Map<
      string,
      { categoryId: string; by: CategorySource }
    >();
    const ruleMatches = await this.rules.match(
      userId,
      candidates.map((row) => ruleText(row)),
    );
    const forAi: ListRow[] = [];
    for (const row of candidates) {
      const text = ruleText(row);
      const rule = text ? ruleMatches.get(text) : undefined;
      if (rule) {
        suggestions.set(row.id, {
          categoryId: rule.categoryId,
          by: CategorySource.rule,
        });
      } else {
        forAi.push(row);
      }
    }

    if (forAi.length > 0) {
      for (const [id, categoryId] of await this.suggestWithAi(userId, forAi)) {
        suggestions.set(id, { categoryId, by: CategorySource.ai });
      }
    }

    if (suggestions.size > 0) {
      await this.prisma.$transaction(
        [...suggestions].map(([id, suggestion]) =>
          this.prisma.transaction.updateMany({
            where: { id, userId, categoryId: null },
            data: {
              suggestedCategoryId: suggestion.categoryId,
              suggestedBy: suggestion.by,
            },
          }),
        ),
      );
    }

    const updated = await this.load(userId, unique);
    return updated.map((row) => mapTransaction(row));
  }

  /**
   * Suggests a category for the newest uncategorized movements that have no
   * suggestion yet (up to AI_SUGGEST_PER_RUN, in batches): merchant rules,
   * then the AI. Nothing is applied; the user accepts or rejects each
   * suggestion. Returns how many got one.
   */
  async suggestUncategorized(
    userId: string,
    limit = AI_SUGGEST_PER_RUN,
  ): Promise<number> {
    const rows = await this.prisma.transaction.findMany({
      where: { ...uncategorizedWhere(userId), suggestedCategoryId: null },
      select: { id: true },
      orderBy: [{ txnDate: 'desc' }, { id: 'desc' }],
      take: limit,
    });
    let suggested = 0;
    for (let i = 0; i < rows.length; i += MAX_SUGGEST_IDS) {
      const batch = rows.slice(i, i + MAX_SUGGEST_IDS).map((row) => row.id);
      const updated = await this.suggest(userId, batch);
      suggested += updated.filter(
        (row) => !row.category && row.suggestedCategory,
      ).length;
    }
    return suggested;
  }

  /** Applies the pending suggestions and learns a merchant rule for each. */
  async accept(userId: string, ids: string[]): Promise<number> {
    const unique = this.checkIds(ids, MAX_CATEGORIZE_IDS);
    return this.prisma.$transaction(
      async (tx) => {
        const rows = await tx.transaction.findMany({
          where: {
            id: { in: unique },
            userId,
            suggestedCategoryId: { not: null },
          },
          select: {
            id: true,
            merchantName: true,
            description: true,
            suggestedCategoryId: true,
          },
        });
        if (rows.length === 0) return 0;
        const count = await tx.$executeRaw`
          UPDATE "Transaction"
          SET "categoryId" = "suggestedCategoryId",
              "categorySource" = COALESCE("suggestedBy", 'ai'::"CategorySource"),
              "suggestedCategoryId" = NULL,
              "suggestedBy" = NULL,
              "updatedAt" = now()
          WHERE "userId" = ${userId}
            AND "id" = ANY(${rows.map((row) => row.id)}::text[])
            AND "suggestedCategoryId" IS NOT NULL`;
        await this.rules.learn(
          tx,
          userId,
          rows.map((row) => ({
            text: ruleText(row),
            categoryId: row.suggestedCategoryId!,
          })),
        );
        return count;
      },
      { timeout: 20_000 },
    );
  }

  /** Drops the pending suggestions; returns how many were cleared. */
  async reject(userId: string, ids: string[]): Promise<number> {
    const unique = this.checkIds(ids, MAX_CATEGORIZE_IDS);
    const { count } = await this.prisma.transaction.updateMany({
      where: { id: { in: unique }, userId, suggestedCategoryId: { not: null } },
      data: { suggestedCategoryId: null, suggestedBy: null },
    });
    return count;
  }

  /**
   * One AI call for the movements without a rule. Sends only the text the
   * user sees (for private movements, never the original), the amount and
   * the type; no account data. Returns category ids by transaction id.
   */
  private async suggestWithAi(
    userId: string,
    rows: ListRow[],
  ): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    try {
      const categories = await this.userCategories(userId);
      const refs = new Map<string, string>();
      const byId = new Map(categories.map((c) => [c.id, c]));
      const spanish = (category: CategoryRow) =>
        category.translations.find((t) => t.locale === 'es')?.name ??
        category.name;
      const categoryList = categories.map((category, index) => {
        const ref = `c${index + 1}`;
        refs.set(ref, category.id);
        const parent = category.parentId ? byId.get(category.parentId) : null;
        return {
          ref,
          name: parent
            ? `${spanish(parent)} > ${spanish(category)}`
            : spanish(category),
        };
      });
      const movements = rows.map((row, index) => ({
        ref: `t${index + 1}`,
        text: presentTransaction(row).displayName,
        amount: Number(row.amount),
        type: row.type,
      }));

      const { data } = await this.withTimeout(
        this.aiModels.extractFromText(
          {
            prompt: AI_PROMPT,
            text: JSON.stringify({ movements, categories: categoryList }),
            schema: AI_SCHEMA,
            schemaName: 'categorize_movements',
            timeoutMs: AI_TIMEOUT_MS,
          },
          { feature: AiFeatureKey.transaction_categorization },
        ),
      );

      const items = (data as { items?: unknown } | null)?.items;
      if (!Array.isArray(items)) return result;
      for (const item of items as Record<string, unknown>[]) {
        if (!item || typeof item !== 'object') continue;
        const match =
          typeof item.ref === 'string'
            ? /^t(\d+)$/.exec(item.ref.trim())
            : null;
        const index = match ? Number(match[1]) - 1 : -1;
        if (index < 0 || index >= rows.length) continue;
        const categoryId =
          typeof item.categoryRef === 'string'
            ? refs.get(item.categoryRef.trim())
            : undefined;
        if (categoryId && !result.has(rows[index].id)) {
          result.set(rows[index].id, categoryId);
        }
      }
    } catch (error) {
      this.logger.warn(
        `Category suggestions without AI: ${(error as Error).message}`,
      );
    }
    return result;
  }

  private checkIds(ids: string[], max: number): string[] {
    const unique = [...new Set(ids)];
    if (unique.length > max) {
      throw new ValidationError(`At most ${max} movements per request`);
    }
    return unique;
  }

  private async load(userId: string, ids: string[]): Promise<ListRow[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.transaction.findMany({
      where: { id: { in: ids }, userId },
      include: listInclude,
    });
    const order = new Map(ids.map((id, index) => [id, index]));
    return rows.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  }

  /** The user's own categories plus the global defaults. */
  private userCategories(userId: string): Promise<CategoryRow[]> {
    return this.prisma.category.findMany({
      where: pickableCategoryWhere(userId),
      include: { translations: { select: { locale: true, name: true } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`timed out after ${AI_TIMEOUT_MS} ms`)),
        AI_TIMEOUT_MS,
      );
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }
}
