import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service';
import { Category, CreateCategoryInput, UpdateCategoryInput, CategoryUsage } from './dto/category.dto';
import { NotFoundError, ValidationError } from '../../common/exceptions/graphql-error.exception';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string): Promise<Category[]> {
    const categories = await this.prisma.category.findMany({
      where: {
        OR: [
          { userId },
          { userId: null, isDefault: true }, // Global default categories
        ],
      },
      include: {
        children: {
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
        parent: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    return categories.map(this.mapCategory);
  }

  async findById(id: string, userId: string): Promise<Category> {
    const category = await this.prisma.category.findFirst({
      where: {
        id,
        OR: [
          { userId },
          { userId: null, isDefault: true },
        ],
      },
      include: {
        children: {
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
        parent: true,
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
        OR: [
          { userId },
          { userId: null, isDefault: true },
        ],
      },
      include: {
        children: {
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          include: {
            children: {
              orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
            },
          },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    return categories.map(this.mapCategory);
  }

  async create(userId: string, input: CreateCategoryInput): Promise<Category> {
    // Validate parent category exists and belongs to user
    if (input.parentId) {
      const parent = await this.prisma.category.findFirst({
        where: {
          id: input.parentId,
          OR: [
            { userId },
            { userId: null, isDefault: true },
          ],
        },
      });

      if (!parent) {
        throw new NotFoundError('Parent category not found');
      }

      // Check for circular reference by ensuring parent is not a child of any potential children
      const hasCircularRef = await this.checkCircularReference(input.parentId, userId, input.name);
      if (hasCircularRef) {
        throw new ValidationError('Circular reference detected');
      }
    }

    // Check for duplicate name in same level
    const existing = await this.prisma.category.findFirst({
      where: {
        userId,
        parentId: input.parentId || null,
        name: input.name,
      },
    });

    if (existing) {
      throw new ValidationError('Category with this name already exists at this level');
    }

    const category = await this.prisma.category.create({
      data: {
        userId,
        parentId: input.parentId,
        name: input.name,
        sortOrder: input.sortOrder,
        isDefault: false,
      },
      include: {
        children: true,
        parent: true,
      },
    });

    return this.mapCategory(category);
  }

  async update(id: string, userId: string, input: UpdateCategoryInput): Promise<Category> {
    const existingCategory = await this.prisma.category.findFirst({
      where: { id, userId },
    });

    if (!existingCategory) {
      throw new NotFoundError('Category not found');
    }

    if (existingCategory.isDefault) {
      throw new ValidationError('Cannot update default categories');
    }

    // Validate parent category if being changed
    if (input.parentId) {
      if (input.parentId === id) {
        throw new ValidationError('Category cannot be its own parent');
      }

      const parent = await this.prisma.category.findFirst({
        where: {
          id: input.parentId,
          OR: [
            { userId },
            { userId: null, isDefault: true },
          ],
        },
      });

      if (!parent) {
        throw new NotFoundError('Parent category not found');
      }

      // Check for circular reference
      const hasCircularRef = await this.checkCircularReference(input.parentId, userId, input.name || existingCategory.name, id);
      if (hasCircularRef) {
        throw new ValidationError('Circular reference detected');
      }
    }

    const updatedCategory = await this.prisma.category.update({
      where: { id },
      data: input,
      include: {
        children: true,
        parent: true,
      },
    });

    return this.mapCategory(updatedCategory);
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

  async getCategoryUsage(userId: string, dateFrom?: Date, dateTo?: Date): Promise<CategoryUsage[]> {
    const categories = await this.prisma.category.findMany({
      where: {
        OR: [
          { userId },
          { userId: null, isDefault: true },
        ],
      },
      include: {
        transactions: {
          where: {
            userId,
            ...(dateFrom && { txnDate: { gte: dateFrom } }),
            ...(dateTo && { txnDate: { lte: dateTo } }),
            type: { not: 'transfer' }, // Exclude transfers from usage stats
          },
          select: {
            amount: true,
            type: true,
          },
        },
      },
    });

    return categories
      .map(category => {
        const totalAmount = category.transactions.reduce((sum, txn) => {
          const amount = Number(txn.amount);
          return sum + (txn.type === 'expense' ? amount : -amount);
        }, 0);

        const transactionCount = category.transactions.length;

        return {
          categoryId: category.id,
          categoryName: category.name,
          totalAmount,
          transactionCount,
          averageAmount: transactionCount > 0 ? totalAmount / transactionCount : 0,
        };
      })
      .filter(usage => usage.transactionCount > 0)
      .sort((a, b) => Math.abs(b.totalAmount) - Math.abs(a.totalAmount));
  }

  async suggestCategoryForMerchant(userId: string, merchantName: string): Promise<Category | null> {
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
        category: true,
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
    const categoryCount: Record<string, { category: any; count: number }> = {};

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
      { category: null, count: 0 }
    );

    return mostCommon.category ? this.mapCategory(mostCommon.category) : null;
  }

  async createDefaultCategories(userId: string): Promise<void> {
    const defaultCategories = [
      // Expenses
      { name: 'Food & Dining', children: ['Groceries', 'Restaurants', 'Coffee & Snacks'] },
      { name: 'Transportation', children: ['Gas', 'Public Transit', 'Parking', 'Car Maintenance'] },
      { name: 'Shopping', children: ['Clothing', 'Electronics', 'Books', 'General'] },
      { name: 'Bills & Utilities', children: ['Electricity', 'Water', 'Internet', 'Phone', 'Insurance'] },
      { name: 'Entertainment', children: ['Movies', 'Sports', 'Hobbies', 'Subscriptions'] },
      { name: 'Health & Medical', children: ['Doctor', 'Pharmacy', 'Fitness', 'Insurance'] },
      { name: 'Education', children: ['Tuition', 'Books', 'Supplies'] },
      { name: 'Personal Care', children: ['Hair', 'Beauty', 'Clothing'] },
      
      // Income
      { name: 'Income', children: ['Salary', 'Freelance', 'Investments', 'Other Income'] },
      
      // Other
      { name: 'Uncategorized', children: [] },
    ];

    for (let i = 0; i < defaultCategories.length; i++) {
      const parent = defaultCategories[i];
      
      const parentCategory = await this.prisma.category.create({
        data: {
          userId,
          name: parent.name,
          sortOrder: i + 1,
          isDefault: false,
        },
      });

      // Create child categories
      for (let j = 0; j < parent.children.length; j++) {
        await this.prisma.category.create({
          data: {
            userId,
            parentId: parentCategory.id,
            name: parent.children[j],
            sortOrder: j + 1,
            isDefault: false,
          },
        });
      }
    }
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
    if (parentCategory.name === categoryName && parentCategory.id !== excludeId) {
      return true;
    }

    // Check parent's parent recursively
    if (parentCategory.parentId) {
      return this.checkCircularReference(parentCategory.parentId, userId, categoryName, excludeId);
    }

    return false;
  }

  private mapCategory(category: any): Category {
    return {
      id: category.id,
      userId: category.userId,
      parentId: category.parentId,
      name: category.name,
      isDefault: category.isDefault,
      sortOrder: category.sortOrder,
      createdAt: category.createdAt,
      children: category.children?.map(this.mapCategory) || undefined,
      parent: category.parent ? this.mapCategory(category.parent) : undefined,
    };
  }
}