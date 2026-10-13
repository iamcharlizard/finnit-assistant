import { Injectable } from '@nestjs/common';
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
import { Prisma } from '@finnit/database';
import { Category } from '../../common/types/models/category.model';
import { createDefaultCategories } from '../auth/default-categories';
import {
  TranslationService,
  type LocalizedNames,
} from '../translation/translation.service';
import { APP_LOCALES, AppLocale, DEFAULT_LOCALE } from '../translation/locale';

/** Every query loads the names per locale, so `name` resolves without N+1. */
const translations = { select: { locale: true, name: true } } as const;
const byOrder: Prisma.CategoryOrderByWithRelationInput[] = [
  { sortOrder: 'asc' },
  { name: 'asc' },
];

type CategoryRow = Prisma.CategoryGetPayload<Record<string, never>> & {
  translations?: { locale: string; name: string }[];
  children?: CategoryRow[];
  parent?: CategoryRow | null;
};

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly translation: TranslationService,
  ) {}

  async findAll(userId: string): Promise<Category[]> {
    const categories = await this.prisma.category.findMany({
      where: {
        OR: [
          { userId },
          { userId: null, isDefault: true }, // Global default categories
        ],
      },
      include: {
        translations,
        children: { orderBy: byOrder, include: { translations } },
        parent: { include: { translations } },
      },
      orderBy: byOrder,
    });

    return categories.map((category) => this.mapCategory(category));
  }

  async findById(id: string, userId: string): Promise<Category> {
    const category = await this.prisma.category.findFirst({
      where: {
        id,
        OR: [{ userId }, { userId: null, isDefault: true }],
      },
      include: {
        translations,
        children: { orderBy: byOrder, include: { translations } },
        parent: { include: { translations } },
      },
    });

    if (!category) {
      throw new NotFoundError('Category not found');
    }

    return this.mapCategory(category);
  }

  async findRootCategories(userId: string): Promise<Category[]> {
    const categories = await this.prisma.category.findMany({
      where: {
        parentId: null,
        OR: [{ userId }, { userId: null, isDefault: true }],
      },
      include: {
        translations,
        children: {
          orderBy: byOrder,
          include: {
            translations,
            children: { orderBy: byOrder, include: { translations } },
          },
        },
      },
      orderBy: byOrder,
    });

    return categories.map((category) => this.mapCategory(category));
  }

  /**
   * The user may type the name in any language: it is stored in English
   * (Category.name) with its es/en translations. Translation never blocks
   * creation (see TranslationService).
   */
  async create(userId: string, input: CreateCategoryInput): Promise<Category> {
    const typedName = input.name.trim();
    if (!typedName) {
      throw new ValidationError('Category name is required');
    }

    // Validate parent category exists and belongs to user
    if (input.parentId) {
      const parent = await this.prisma.category.findFirst({
        where: {
          id: input.parentId,
          OR: [{ userId }, { userId: null, isDefault: true }],
        },
      });

      if (!parent) {
        throw new NotFoundError('Parent category not found');
      }
    }

    const names = await this.translation.translateName(typedName);
    const name = names.en.name;

    if (input.parentId) {
      // Check for circular reference by ensuring parent is not a child of any potential children
      const hasCircularRef = await this.checkCircularReference(
        input.parentId,
        userId,
        name,
      );
      if (hasCircularRef) {
        throw new ValidationError('Circular reference detected');
      }
    }

    // Names are unique per user (category_user_name_unique), at any level.
    await this.assertNameAvailable(userId, name);

    try {
      const category = await this.prisma.category.create({
        data: {
          userId,
          parentId: input.parentId,
          name,
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
    const existingCategory = await this.prisma.category.findFirst({
      where: { id, userId },
      include: { translations },
    });

    if (!existingCategory) {
      throw new NotFoundError('Category not found');
    }

    if (existingCategory.isDefault) {
      throw new ValidationError('Cannot update default categories');
    }

    // A rename only when the text differs from every current name (clients
    // often send back the localized name unchanged).
    const typedName = input.name?.trim();
    if (input.name !== undefined && !typedName) {
      throw new ValidationError('Category name is required');
    }
    const currentNames = new Set([
      existingCategory.name,
      ...existingCategory.translations.map((t) => t.name),
    ]);
    const names: LocalizedNames | undefined =
      typedName && !currentNames.has(typedName)
        ? await this.translation.translateName(typedName)
        : undefined;
    const name = names?.en.name ?? existingCategory.name;

    // Validate parent category if being changed
    if (input.parentId) {
      if (input.parentId === id) {
        throw new ValidationError('Category cannot be its own parent');
      }

      const parent = await this.prisma.category.findFirst({
        where: {
          id: input.parentId,
          OR: [{ userId }, { userId: null, isDefault: true }],
        },
      });

      if (!parent) {
        throw new NotFoundError('Parent category not found');
      }

      // Check for circular reference
      const hasCircularRef = await this.checkCircularReference(
        input.parentId,
        userId,
        name,
        id,
      );
      if (hasCircularRef) {
        throw new ValidationError('Circular reference detected');
      }
    }

    if (names && name !== existingCategory.name) {
      await this.assertNameAvailable(userId, name, id);
    }

    try {
      const updatedCategory = await this.prisma.category.update({
        where: { id },
        data: {
          ...(input.parentId !== undefined && { parentId: input.parentId }),
          ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
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

      return this.mapCategory(updatedCategory);
    } catch (error) {
      throw this.duplicateNameError(error);
    }
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const category = await this.prisma.category.findFirst({
      where: { id, userId },
      include: {
        children: true,
        transactions: true,
        budgetCaps: true,
      },
    });

    if (!category) {
      throw new NotFoundError('Category not found');
    }

    if (category.isDefault) {
      throw new ValidationError('Cannot delete default categories');
    }

    if (category.children.length > 0) {
      throw new ValidationError('Cannot delete category with subcategories');
    }

    if (category.transactions.length > 0 || category.budgetCaps.length > 0) {
      throw new ValidationError('Cannot delete category that is in use');
    }

    await this.prisma.category.delete({
      where: { id },
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
      where: {
        OR: [{ userId }, { userId: null, isDefault: true }],
      },
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

  /** Adds the starter categories the user is missing (same list as sign-up). */
  async createDefaultCategories(userId: string): Promise<void> {
    await createDefaultCategories(this.prisma, userId, { skipExisting: true });
  }

  private async assertNameAvailable(
    userId: string,
    name: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.prisma.category.findFirst({
      where: {
        userId,
        name: { equals: name, mode: 'insensitive' },
        ...(excludeId && { id: { not: excludeId } }),
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

  private async checkCircularReference(
    parentId: string,
    userId: string,
    categoryName: string,
    excludeId?: string,
  ): Promise<boolean> {
    // This is a simplified check - in production, you'd want a more robust implementation
    const parentCategory = await this.prisma.category.findUnique({
      where: { id: parentId },
      include: { parent: true },
    });

    if (!parentCategory) {
      return false;
    }

    // Check if the parent has the same name as what we're trying to create
    if (
      parentCategory.name === categoryName &&
      parentCategory.id !== excludeId
    ) {
      return true;
    }

    // Check parent's parent recursively
    if (parentCategory.parentId) {
      return this.checkCircularReference(
        parentCategory.parentId,
        userId,
        categoryName,
        excludeId,
      );
    }

    return false;
  }

  private mapCategory(category: CategoryRow): Category {
    return {
      id: category.id,
      userId: category.userId || undefined,
      parentId: category.parentId || undefined,
      name: category.name,
      key: category.key,
      isDefault: category.isDefault,
      sortOrder: category.sortOrder || undefined,
      createdAt: category.createdAt,
      translations: category.translations
        ? Object.fromEntries(
            category.translations.map((t) => [t.locale, t.name]),
          )
        : undefined,
      children: category.children
        ? category.children.map((child) => this.mapCategory(child))
        : undefined,
      parent:
        category.parentId && category.parent
          ? this.mapCategory(category.parent)
          : undefined,
    };
  }
}
