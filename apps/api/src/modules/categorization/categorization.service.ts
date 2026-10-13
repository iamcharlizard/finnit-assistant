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
import { MerchantRulesService, ruleText } from './merchant-rules.service';

export const MAX_CATEGORIZE_IDS = 500;
export const MAX_SUGGEST_IDS = 100;
export const AI_TIMEOUT_MS = 20_000;

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
  ) {}

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
        OR: [{ userId }, { userId: null, isDefault: true }],
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
      where: { OR: [{ userId }, { userId: null, isDefault: true }] },
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
