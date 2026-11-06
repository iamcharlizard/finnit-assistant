import { Injectable } from '@nestjs/common';
import { CategoryKind, Prisma } from '@finnit/database';
import { PrismaService } from '../../services/prisma.service';
import {
  CreateCategoryInput,
  UpdateCategoryInput,
  CategoryUsage,
} from './dto/category.dto';
import {
  NotFoundError,
  ValidationError,
} from '../../common/exceptions/graphql-error.exception';
import { Category } from '../../common/types/models/category.model';
import {
  TranslationService,
  type LocalizedNames,
} from '../translation/translation.service';
import { APP_LOCALES, AppLocale, DEFAULT_LOCALE } from '../translation/locale';
import { pickableCategoryWhere, visibleCategoryWhere } from './category-scope';

/** Every query loads the names per locale, so `name` resolves without N+1. */
const translations = { select: { locale: true, name: true } } as const;
const byOrder: Prisma.CategoryOrderByWithRelationInput[] = [
  { sortOrder: 'asc' },
  { name: 'asc' },
];

/** Icon and color keys are short identifiers the clients know. */
const STYLE_KEY = /^[a-z][a-z0-9_]{0,31}$/;

type CategoryRow = Prisma.CategoryGetPayload<Record<string, never>> & {
  translations?: { locale: string; name: string }[];
  children?: CategoryRow[];
  parent?: CategoryRow | null;
};

/** What still points at a category, so deleting it would lose something. */
export interface CategoryReferences {
  transactions: number;
  children: number;
  budgetCaps: number;
  rules: number;
  aliases: number;
  recurring: number;
}

/**
 * Categories: the global catalog (default-categories.ts; read-only, the
 * user can hide entries) plus the user's own, which they create, rename,
 * restyle and delete. Two levels at most: a subcategory's parent is a root,
 * and it shares its parent's kind (spending or income).
 */
@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly translation: TranslationService,
  ) {}

  /** The user's categories; without `includeHidden`, the ones they hid are left out. */
  async findAll(
    userId: string,
    options: { includeHidden?: boolean } = {},
  ): Promise<Category[]> {
    const scope = this.scope(userId, options.includeHidden);
    const [categories, hidden] = await Promise.all([
      this.prisma.category.findMany({
        where: scope,
        include: {
          translations,
          children: {
            where: scope,
            orderBy: byOrder,
            include: { translations },
          },
          parent: { include: { translations } },
        },
        orderBy: byOrder,
      }),
      this.hiddenIds(userId),
    ]);

    return categories.map((category) => this.mapCategory(category, hidden));
  }

  async findById(id: string, userId: string): Promise<Category> {
    const [category, hidden] = await Promise.all([
      this.prisma.category.findFirst({
        where: { id, ...visibleCategoryWhere(userId) },
        include: {
          translations,
          children: {
            where: visibleCategoryWhere(userId),
            orderBy: byOrder,
            include: { translations },
          },
          parent: { include: { translations } },
        },
      }),
      this.hiddenIds(userId),
    ]);

    if (!category) {
      throw new NotFoundError('Category not found');
    }

    return this.mapCategory(category, hidden);
  }

  async findRootCategories(
    userId: string,
    options: { includeHidden?: boolean } = {},
  ): Promise<Category[]> {
    const scope = this.scope(userId, options.includeHidden);
    const [categories, hidden] = await Promise.all([
      this.prisma.category.findMany({
        where: { parentId: null, ...scope },
        include: {
          translations,
          children: {
            where: scope,
            orderBy: byOrder,
            include: { translations },
          },
        },
        orderBy: byOrder,
      }),
      this.hiddenIds(userId),
    ]);

    return categories.map((category) => this.mapCategory(category, hidden));
  }

  /** Ids of the categories the user hid. */
  async hiddenIds(userId: string): Promise<Set<string>> {
    const rows = await this.prisma.categoryHidden.findMany({
      where: { userId },
      select: { categoryId: true },
    });
    return new Set(rows.map((row) => row.categoryId));
  }

  /**
   * The user may type the name in any language: it is stored in English
   * (Category.name) with its es/en translations. Translation never blocks
   * creation (see TranslationService). A subcategory may hang from a
   * catalog category or from one of the user's own roots.
   */
  async create(userId: string, input: CreateCategoryInput): Promise<Category> {
    const typedName = input.name.trim();
    if (!typedName) {
      throw new ValidationError('Category name is required');
    }
    this.assertStyle(input);

    const parent = input.parentId
      ? await this.rootParent(userId, input.parentId)
      : null;
    const kind = parent?.kind ?? input.kind ?? CategoryKind.expense;

    const names = await this.translation.translateName(typedName);
    const name = names.en.name;
    await this.assertNameAvailable(userId, [typedName, name]);

    try {
      const category = await this.prisma.category.create({
        data: {
          userId,
          parentId: parent?.id ?? null,
          name,
          kind,
          icon: input.icon ?? null,
          color: input.color ?? null,
          sortOrder: input.sortOrder,
          isDefault: false,
          translations: {
            create: APP_LOCALES.map((locale) => ({
              locale,
              name: names[locale].name,
              source: names[locale].source,
            })),
          },
        },
        include: {
          translations,
          children: { include: { translations } },
          parent: { include: { translations } },
        },
      });

      return this.mapCategory(category);
    } catch (error) {
      throw this.duplicateNameError(error);
    }
  }

  async update(
    id: string,
    userId: string,
    input: UpdateCategoryInput,
  ): Promise<Category> {
    const existing = await this.prisma.category.findFirst({
      where: { id, ...visibleCategoryWhere(userId) },
      include: { translations, children: { select: { id: true } } },
    });

    if (!existing) {
      throw new NotFoundError('Category not found');
    }
    if (existing.isDefault || existing.userId !== userId) {
      throw new ValidationError('Default categories cannot be changed');
    }
    this.assertStyle(input);

    // A rename only when the text differs from every current name (clients
    // often send back the localized name unchanged).
    const typedName = input.name?.trim();
    if (input.name !== undefined && !typedName) {
      throw new ValidationError('Category name is required');
    }
    const currentNames = new Set([
      existing.name,
      ...existing.translations.map((t) => t.name),
    ]);
    const names: LocalizedNames | undefined =
      typedName && !currentNames.has(typedName)
        ? await this.translation.translateName(typedName)
        : undefined;
    const name = names?.en.name ?? existing.name;
    if (names) {
      await this.assertNameAvailable(userId, [typedName!, name], id);
    }

    // A new parent (null: becomes a root). Only a category without
    // subcategories can become one.
    let parentId = existing.parentId;
    let kind = existing.kind;
    if (input.parentId !== undefined) {
      if (input.parentId === id) {
        throw new ValidationError('Category cannot be its own parent');
      }
      if (input.parentId) {
        if (existing.children.length > 0) {
          throw new ValidationError(
            'A category with subcategories cannot become a subcategory',
          );
        }
        const parent = await this.rootParent(userId, input.parentId);
        parentId = parent.id;
        kind = parent.kind;
      } else {
        parentId = null;
      }
    }
    if (input.kind && input.kind !== kind) {
      if (parentId) {
        throw new ValidationError(
          "A subcategory has its parent's kind; change the parent instead",
        );
      }
      kind = input.kind;
    }

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const row = await tx.category.update({
          where: { id },
          data: {
            parentId,
            kind,
            ...(input.icon !== undefined && { icon: input.icon }),
            ...(input.color !== undefined && { color: input.color }),
            ...(input.sortOrder !== undefined && {
              sortOrder: input.sortOrder,
            }),
            ...(names && {
              name,
              translations: {
                upsert: APP_LOCALES.map((locale) => ({
                  where: { categoryId_locale: { categoryId: id, locale } },
                  create: {
                    locale,
                    name: names[locale].name,
                    source: names[locale].source,
                  },
                  update: {
                    name: names[locale].name,
                    source: names[locale].source,
                  },
                })),
              },
            }),
          },
          include: {
            translations,
            children: { include: { translations } },
            parent: { include: { translations } },
          },
        });
        if (kind !== existing.kind) {
          await tx.category.updateMany({
            where: { parentId: id, userId },
            data: { kind },
          });
        }
        return row;
      });

      return this.mapCategory(updated);
    } catch (error) {
      throw this.duplicateNameError(error);
    }
  }

  /** What would move (or be lost) when deleting one of the user's categories. */
  async references(userId: string, id: string): Promise<CategoryReferences> {
    await this.ownCategory(userId, id);
    const [transactions, children, budgetCaps, rules, aliases, recurring] =
      await Promise.all([
        this.prisma.transaction.count({ where: { userId, categoryId: id } }),
        this.prisma.category.count({ where: { userId, parentId: id } }),
        this.prisma.bUDGET_CATEGORY.count({
          where: { categoryId: id, budget: { userId } },
        }),
        this.prisma.merchantRule.count({ where: { userId, categoryId: id } }),
        this.prisma.merchantAlias.count({ where: { userId, categoryId: id } }),
        this.prisma.recurringExpense.count({
          where: { userId, categoryId: id },
        }),
      ]);
    return { transactions, children, budgetCaps, rules, aliases, recurring };
  }

  /**
   * Deletes one of the user's categories. When something uses it, `moveToId`
   * says where it goes (a category of the same kind): its movements,
   * budget caps, merchant rules, aliases, recurring payments and
   * subcategories; nothing is silently dropped.
   */
  async delete(
    id: string,
    userId: string,
    moveToId?: string | null,
  ): Promise<boolean> {
    const category = await this.ownCategory(userId, id);
    const refs = await this.references(userId, id);
    const inUse = Object.values(refs).some((count) => count > 0);
    if (inUse && !moveToId) {
      throw new ValidationError(
        'This category is in use: choose where to move what it has',
      );
    }

    const target = moveToId
      ? await this.prisma.category.findFirst({
          where: { id: moveToId, ...visibleCategoryWhere(userId) },
          select: { id: true, parentId: true, kind: true },
        })
      : null;
    if (moveToId) {
      if (!target) throw new NotFoundError('Target category not found');
      if (target.id === id || target.parentId === id) {
        throw new ValidationError(
          'Move it to a category other than itself or its subcategories',
        );
      }
      if (target.kind !== category.kind) {
        throw new ValidationError(
          'Move it to a category of the same kind (spending or income)',
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      if (target) {
        const to = target.id;
        // Subcategories go under the target's root.
        await tx.category.updateMany({
          where: { userId, parentId: id },
          data: { parentId: target.parentId ?? to },
        });
        await tx.transaction.updateMany({
          where: { userId, categoryId: id },
          data: { categoryId: to },
        });
        await tx.transaction.updateMany({
          where: { userId, suggestedCategoryId: id },
          data: { suggestedCategoryId: to },
        });
        await tx.merchantAlias.updateMany({
          where: { userId, categoryId: id },
          data: { categoryId: to },
        });
        await tx.recurringExpense.updateMany({
          where: { userId, categoryId: id },
          data: { categoryId: to },
        });
        await tx.merchantTaxId.updateMany({
          where: { userId, categoryId: id },
          data: { categoryId: to },
        });
        await tx.debt.updateMany({
          where: { userId, purposeCategoryId: id },
          data: { purposeCategoryId: to },
        });
        await tx.debtCharge.updateMany({
          where: { debt: { userId }, purposeCategoryId: id },
          data: { purposeCategoryId: to },
        });
        await tx.merchantRule.updateMany({
          where: { userId, categoryId: id },
          data: { categoryId: to },
        });
        // Budget caps: added to the target's cap in the same budget.
        const caps = await tx.bUDGET_CATEGORY.findMany({
          where: { categoryId: id, budget: { userId } },
        });
        for (const cap of caps) {
          const existing = await tx.bUDGET_CATEGORY.findUnique({
            where: {
              budgetId_categoryId: { budgetId: cap.budgetId, categoryId: to },
            },
          });
          if (existing) {
            await tx.bUDGET_CATEGORY.update({
              where: { id: existing.id },
              data: { capAmount: { increment: cap.capAmount } },
            });
            await tx.bUDGET_CATEGORY.delete({ where: { id: cap.id } });
          } else {
            await tx.bUDGET_CATEGORY.update({
              where: { id: cap.id },
              data: { categoryId: to },
            });
          }
        }
      }
      await tx.category.delete({ where: { id } });
    });

    return true;
  }

  /** Hides a category (and its subcategories) from the user's pickers. */
  async hide(userId: string, id: string): Promise<boolean> {
    const category = await this.prisma.category.findFirst({
      where: { id, ...visibleCategoryWhere(userId) },
      select: {
        id: true,
        children: {
          where: visibleCategoryWhere(userId),
          select: { id: true },
        },
      },
    });
    if (!category) throw new NotFoundError('Category not found');
    await this.prisma.categoryHidden.createMany({
      data: [category.id, ...category.children.map((c) => c.id)].map(
        (categoryId) => ({ userId, categoryId }),
      ),
      skipDuplicates: true,
    });
    return true;
  }

  /** Shows it again (with its subcategories, and its parent if hidden). */
  async show(userId: string, id: string): Promise<boolean> {
    const category = await this.prisma.category.findFirst({
      where: { id, ...visibleCategoryWhere(userId) },
      select: {
        id: true,
        parentId: true,
        children: { select: { id: true } },
      },
    });
    if (!category) throw new NotFoundError('Category not found');
    const ids = [category.id, ...category.children.map((c) => c.id)];
    if (category.parentId) ids.push(category.parentId);
    await this.prisma.categoryHidden.deleteMany({
      where: { userId, categoryId: { in: ids } },
    });
    return true;
  }

  async getCategoryUsage(
    userId: string,
    dateFrom?: Date,
    dateTo?: Date,
    locale: AppLocale = DEFAULT_LOCALE,
  ): Promise<CategoryUsage[]> {
    const categories = await this.prisma.category.findMany({
      where: visibleCategoryWhere(userId),
      include: {
        translations: { where: { locale }, select: { name: true } },
        transactions: {
          where: {
            userId,
            ...((dateFrom || dateTo) && {
              txnDate: {
                ...(dateFrom && { gte: dateFrom }),
                ...(dateTo && { lte: dateTo }),
              },
            }),
            // Only real income and spending: transfers move money between
            // accounts and adjustments (e.g. opening balances) correct it.
            type: { in: ['income', 'expense'] },
          },
          select: {
            amount: true,
            type: true,
          },
        },
      },
    });

    return categories
      .map((category) => {
        const totalAmount = category.transactions.reduce((sum, txn) => {
          const amount = Number(txn.amount);
          return sum + (txn.type === 'expense' ? amount : -amount);
        }, 0);

        const transactionCount = category.transactions.length;

        return {
          categoryId: category.id,
          categoryName: category.translations[0]?.name ?? category.name,
          totalAmount,
          transactionCount,
          averageAmount:
            transactionCount > 0 ? totalAmount / transactionCount : 0,
        };
      })
      .filter((usage) => usage.transactionCount > 0)
      .sort((a, b) => Math.abs(b.totalAmount) - Math.abs(a.totalAmount));
  }

  async suggestCategoryForMerchant(
    userId: string,
    merchantName: string,
  ): Promise<Category | null> {
    if (!merchantName) {
      return null;
    }

    // Find transactions with similar merchant names and their categories
    const similarTransactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        merchantName: {
          contains: merchantName.split(' ')[0], // Match first word of merchant name
          mode: 'insensitive',
        },
        categoryId: { not: null },
      },
      include: {
        category: { include: { translations } },
      },
      orderBy: {
        txnDate: 'desc',
      },
      take: 10,
    });

    if (similarTransactions.length === 0) {
      return null;
    }

    // Count category occurrences
    const categoryCount: Record<
      string,
      { category: CategoryRow; count: number }
    > = {};

    for (const txn of similarTransactions) {
      if (txn.category) {
        const categoryId = txn.category.id;
        if (categoryCount[categoryId]) {
          categoryCount[categoryId].count++;
        } else {
          categoryCount[categoryId] = { category: txn.category, count: 1 };
        }
      }
    }

    // Find the most common category
    const mostCommon = Object.values(categoryCount).reduce(
      (max, current) => (current.count > max.count ? current : max),
      { category: null, count: 0 },
    );

    return mostCommon.category ? this.mapCategory(mostCommon.category) : null;
  }

  private scope(
    userId: string,
    includeHidden = false,
  ): Prisma.CategoryWhereInput {
    return includeHidden
      ? visibleCategoryWhere(userId)
      : pickableCategoryWhere(userId);
  }

  /** A visible root category to hang a subcategory from. */
  private async rootParent(
    userId: string,
    parentId: string,
  ): Promise<{ id: string; kind: CategoryKind }> {
    const parent = await this.prisma.category.findFirst({
      where: { id: parentId, ...visibleCategoryWhere(userId) },
      select: { id: true, kind: true, parentId: true },
    });
    if (!parent) {
      throw new NotFoundError('Parent category not found');
    }
    if (parent.parentId) {
      throw new ValidationError(
        'Subcategories go under a main category (two levels at most)',
      );
    }
    return parent;
  }

  private async ownCategory(userId: string, id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, ...visibleCategoryWhere(userId) },
      select: { id: true, userId: true, isDefault: true, kind: true },
    });
    if (!category) {
      throw new NotFoundError('Category not found');
    }
    if (category.isDefault || category.userId !== userId) {
      throw new ValidationError('Default categories cannot be deleted');
    }
    return category;
  }

  private assertStyle(input: {
    icon?: string | null;
    color?: string | null;
  }): void {
    for (const value of [input.icon, input.color]) {
      if (value != null && !STYLE_KEY.test(value)) {
        throw new ValidationError('Unknown icon or color');
      }
    }
  }

  /**
   * Names are unique among the categories the user sees: their own and the
   * catalog's, in any language.
   */
  private async assertNameAvailable(
    userId: string,
    names: string[],
    excludeId?: string,
  ): Promise<void> {
    const wanted = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
    const existing = await this.prisma.category.findFirst({
      where: {
        ...visibleCategoryWhere(userId),
        ...(excludeId && { id: { not: excludeId } }),
        AND: [
          {
            OR: wanted.flatMap((name) => [
              { name: { equals: name, mode: 'insensitive' as const } },
              {
                translations: {
                  some: {
                    name: { equals: name, mode: 'insensitive' as const },
                  },
                },
              },
            ]),
          },
        ],
      },
      select: { id: true },
    });
    if (existing) {
      throw new ValidationError('A category with this name already exists');
    }
  }

  private duplicateNameError(error: unknown): unknown {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ValidationError('A category with this name already exists');
    }
    return error;
  }

  private mapCategory(category: CategoryRow, hidden?: Set<string>): Category {
    return {
      id: category.id,
      userId: category.userId || undefined,
      parentId: category.parentId || undefined,
      name: category.name,
      key: category.key,
      isDefault: category.isDefault,
      kind: category.kind,
      icon: category.icon,
      color: category.color,
      sortOrder: category.sortOrder || undefined,
      createdAt: category.createdAt,
      ...(hidden && { hidden: hidden.has(category.id) }),
      translations: category.translations
        ? Object.fromEntries(
            category.translations.map((t) => [t.locale, t.name]),
          )
        : undefined,
      children: category.children
        ? category.children.map((child) => this.mapCategory(child, hidden))
        : undefined,
      parent:
        category.parentId && category.parent
          ? this.mapCategory(category.parent, hidden)
          : undefined,
    };
  }
}
