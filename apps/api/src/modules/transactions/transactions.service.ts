import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service';
import {
  Transaction,
  CreateTransactionInput,
  UpdateTransactionInput,
  TransactionConnection,
  TransactionsArgs,
  TransactionFilters,
  Attachment,
  CreateAttachmentInput,
} from './dto/transaction.dto';
import { NotFoundError, ValidationError } from '../../common/exceptions/graphql-error.exception';
import { PaginationUtil } from '../../common/utils/pagination.util';
import { TransactionSource } from '@finnit/database';

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, input: CreateTransactionInput): Promise<Transaction> {
    // Validate account belongs to user
    const account = await this.prisma.account.findFirst({
      where: { id: input.accountId, userId },
    });

    if (!account) {
      throw new NotFoundError('Account not found');
    }

    // Auto-categorize if no category provided but merchant name exists
    let categoryId = input.categoryId;
    if (!categoryId && input.merchantName) {
      const suggestedCategory = await this.suggestCategoryForMerchant(userId, input.merchantName);
      categoryId = suggestedCategory?.id;
    }

    // Validate category belongs to user (if provided)
    if (categoryId) {
      const category = await this.prisma.category.findFirst({
        where: {
          id: categoryId,
          OR: [
            { userId },
            { userId: null, isDefault: true },
          ],
        },
      });

      if (!category) {
        throw new NotFoundError('Category not found');
      }
    }

    return await this.prisma.$transaction(async (tx) => {
      // Create transaction
      const transaction = await tx.transaction.create({
        data: {
          userId,
          accountId: input.accountId,
          categoryId,
          type: input.type,
          amount: input.amount,
          currency: input.currency,
          txnDate: input.txnDate,
          description: input.description,
          merchantName: input.merchantName,
          isPending: input.isPending || false,
          source: TransactionSource.manual,
        },
      });

      // Update account balance if not pending
      if (!transaction.isPending) {
        const balanceChange = input.type === 'income' ? input.amount : -input.amount;
        await tx.account.update({
          where: { id: input.accountId },
          data: {
            balanceCurrent: {
              increment: balanceChange,
            },
          },
        });
      }

      return this.mapTransaction(transaction);
    });
  }

  async findMany(userId: string, args: TransactionsArgs): Promise<TransactionConnection> {
    const where: any = { userId };
    
    if (args.filters) {
      this.applyFilters(where, args.filters);
    }

    // Handle cursor pagination
    const limit = args.first || args.last || 20;
    let cursor: any = undefined;
    
    if (args.after) {
      const decodedCursor = PaginationUtil.decodeCursor(args.after);
      cursor = { id: { gt: decodedCursor } };
    } else if (args.before) {
      const decodedCursor = PaginationUtil.decodeCursor(args.before);
      cursor = { id: { lt: decodedCursor } };
    }

    const transactions = await this.prisma.transaction.findMany({
      where: { ...where, ...cursor },
      take: limit,
      orderBy: { txnDate: 'desc' },
    });

    const totalCount = await this.prisma.transaction.count({ where });

    return PaginationUtil.createConnection(
      transactions.map(this.mapTransaction),
      args,
      totalCount,
      (transaction) => PaginationUtil.encodeCursor(transaction.id),
    );
  }

  async findById(id: string, userId: string): Promise<Transaction> {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, userId },
      include: {
        attachments: true,
      },
    });

    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }

    return this.mapTransaction(transaction);
  }

  async update(id: string, userId: string, input: UpdateTransactionInput): Promise<Transaction> {
    const existingTransaction = await this.prisma.transaction.findFirst({
      where: { id, userId },
    });

    if (!existingTransaction) {
      throw new NotFoundError('Transaction not found');
    }

    if (existingTransaction.source !== TransactionSource.manual) {
      throw new ValidationError('Cannot modify imported transactions');
    }

    // Validate category belongs to user (if provided)
    if (input.categoryId) {
      const category = await this.prisma.category.findFirst({
        where: {
          id: input.categoryId,
          OR: [
            { userId },
            { userId: null, isDefault: true },
          ],
        },
      });

      if (!category) {
        throw new NotFoundError('Category not found');
      }
    }

    return await this.prisma.$transaction(async (tx) => {
      // Calculate balance adjustment if amount changed
      if (input.amount && input.amount !== Number(existingTransaction.amount)) {
        const oldAmount = existingTransaction.type === 'income' 
          ? Number(existingTransaction.amount) 
          : -Number(existingTransaction.amount);
        const newAmount = existingTransaction.type === 'income' 
          ? input.amount 
          : -input.amount;
        const balanceChange = newAmount - oldAmount;

        await tx.account.update({
          where: { id: existingTransaction.accountId },
          data: {
            balanceCurrent: {
              increment: balanceChange,
            },
          },
        });
      }

      const updatedTransaction = await tx.transaction.update({
        where: { id },
        data: input,
      });

      return this.mapTransaction(updatedTransaction);
    });
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, userId },
      include: {
        transferFrom: true,
        transferTo: true,
        debtPayment: true,
        goalContributions: true,
      },
    });

    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }

    if (transaction.source !== TransactionSource.manual) {
      throw new ValidationError('Cannot delete imported transactions');
    }

    if (transaction.transferFrom || transaction.transferTo) {
      throw new ValidationError('Cannot delete transaction that is part of a transfer');
    }

    if (transaction.debtPayment) {
      throw new ValidationError('Cannot delete transaction that is a debt payment');
    }

    if (transaction.goalContributions.length > 0) {
      throw new ValidationError('Cannot delete transaction that has goal contributions');
    }

    await this.prisma.$transaction(async (tx) => {
      // Adjust account balance
      if (!transaction.isPending) {
        const balanceChange = transaction.type === 'income' 
          ? -Number(transaction.amount) 
          : Number(transaction.amount);
        
        await tx.account.update({
          where: { id: transaction.accountId },
          data: {
            balanceCurrent: {
              increment: balanceChange,
            },
          },
        });
      }

      // Delete transaction
      await tx.transaction.delete({
        where: { id },
      });
    });

    return true;
  }

  async addAttachment(userId: string, input: CreateAttachmentInput): Promise<Attachment> {
    // Validate transaction belongs to user
    const transaction = await this.prisma.transaction.findFirst({
      where: { id: input.transactionId, userId },
    });

    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }

    const attachment = await this.prisma.attachment.create({
      data: input,
    });

    return this.mapAttachment(attachment);
  }

  async removeAttachment(id: string, userId: string): Promise<boolean> {
    const attachment = await this.prisma.attachment.findFirst({
      where: { 
        id,
        transaction: { userId },
      },
      include: { transaction: true },
    });

    if (!attachment) {
      throw new NotFoundError('Attachment not found');
    }

    await this.prisma.attachment.delete({
      where: { id },
    });

    return true;
  }

  async bulkCreate(userId: string, transactions: CreateTransactionInput[]): Promise<Transaction[]> {
    if (transactions.length === 0) {
      return [];
    }

    // Validate all accounts belong to user
    const accountIds = [...new Set(transactions.map(t => t.accountId))];
    const accounts = await this.prisma.account.findMany({
      where: { id: { in: accountIds }, userId },
    });

    if (accounts.length !== accountIds.length) {
      throw new NotFoundError('One or more accounts not found');
    }

    return await this.prisma.$transaction(async (tx) => {
      const results: Transaction[] = [];

      for (const input of transactions) {
        // Auto-categorize if no category provided but merchant name exists
        let categoryId = input.categoryId;
        if (!categoryId && input.merchantName) {
          const suggestedCategory = await this.suggestCategoryForMerchant(userId, input.merchantName);
          categoryId = suggestedCategory?.id;
        }

        const transaction = await tx.transaction.create({
          data: {
            userId,
            accountId: input.accountId,
            categoryId,
            type: input.type,
            amount: input.amount,
            currency: input.currency,
            txnDate: input.txnDate,
            description: input.description,
            merchantName: input.merchantName,
            isPending: input.isPending || false,
            source: TransactionSource.imported,
          },
        });

        // Update account balance if not pending
        if (!transaction.isPending) {
          const balanceChange = input.type === 'income' ? input.amount : -input.amount;
          await tx.account.update({
            where: { id: input.accountId },
            data: {
              balanceCurrent: {
                increment: balanceChange,
              },
            },
          });
        }

        results.push(this.mapTransaction(transaction));
      }

      return results;
    });
  }

  async recategorizeTransaction(id: string, userId: string, categoryId: string): Promise<Transaction> {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, userId },
    });

    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }

    // Validate category belongs to user
    const category = await this.prisma.category.findFirst({
      where: {
        id: categoryId,
        OR: [
          { userId },
          { userId: null, isDefault: true },
        ],
      },
    });

    if (!category) {
      throw new NotFoundError('Category not found');
    }

    const updatedTransaction = await this.prisma.transaction.update({
      where: { id },
      data: { categoryId },
    });

    return this.mapTransaction(updatedTransaction);
  }

  async markAsPending(id: string, userId: string, isPending: boolean): Promise<Transaction> {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, userId },
    });

    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }

    return await this.prisma.$transaction(async (tx) => {
      // Adjust account balance based on pending status change
      if (transaction.isPending !== isPending) {
        const balanceChange = transaction.type === 'income' 
          ? Number(transaction.amount) 
          : -Number(transaction.amount);
        
        // If changing from pending to confirmed, add to balance
        // If changing from confirmed to pending, subtract from balance
        const adjustment = isPending ? -balanceChange : balanceChange;

        await tx.account.update({
          where: { id: transaction.accountId },
          data: {
            balanceCurrent: {
              increment: adjustment,
            },
          },
        });
      }

      const updatedTransaction = await tx.transaction.update({
        where: { id },
        data: { isPending },
      });

      return this.mapTransaction(updatedTransaction);
    });
  }

  async getTransactionSummary(
    userId: string, 
    dateFrom: Date, 
    dateTo: Date
  ): Promise<{ totalIncome: number; totalExpenses: number; netCashFlow: number; transactionCount: number }> {
    const summary = await this.prisma.transaction.aggregate({
      where: {
        userId,
        txnDate: {
          gte: dateFrom,
          lte: dateTo,
        },
        isPending: false,
        type: { not: 'transfer' }, // Exclude transfers to avoid double counting
      },
      _sum: {
        amount: true,
      },
      _count: {
        id: true,
      },
    });

    // Separate income and expenses
    const incomeTransactions = await this.prisma.transaction.aggregate({
      where: {
        userId,
        type: 'income',
        txnDate: {
          gte: dateFrom,
          lte: dateTo,
        },
        isPending: false,
      },
      _sum: {
        amount: true,
      },
    });

    const expenseTransactions = await this.prisma.transaction.aggregate({
      where: {
        userId,
        type: 'expense',
        txnDate: {
          gte: dateFrom,
          lte: dateTo,
        },
        isPending: false,
      },
      _sum: {
        amount: true,
      },
    });

    const totalIncome = Number(incomeTransactions._sum.amount || 0);
    const totalExpenses = Number(expenseTransactions._sum.amount || 0);

    return {
      totalIncome,
      totalExpenses,
      netCashFlow: totalIncome - totalExpenses,
      transactionCount: summary._count.id,
    };
  }

  private async suggestCategoryForMerchant(userId: string, merchantName: string): Promise<{ id: string } | null> {
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
      take: 5,
    });

    if (similarTransactions.length === 0) {
      return null;
    }

    // Count category occurrences
    const categoryCount: Record<string, number> = {};

    for (const txn of similarTransactions) {
      if (txn.categoryId) {
        categoryCount[txn.categoryId] = (categoryCount[txn.categoryId] || 0) + 1;
      }
    }

    // Find the most common category
    const mostCommonCategoryId = Object.keys(categoryCount).reduce(
      (maxId, currentId) => 
        categoryCount[currentId] > (categoryCount[maxId] || 0) ? currentId : maxId,
      Object.keys(categoryCount)[0]
    );

    return mostCommonCategoryId ? { id: mostCommonCategoryId } : null;
  }

  private applyFilters(where: any, filters: TransactionFilters): void {
    if (filters.accountId) {
      where.accountId = filters.accountId;
    }

    if (filters.categoryId) {
      where.categoryId = filters.categoryId;
    }

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.source) {
      where.source = filters.source;
    }

    if (filters.isPending !== undefined) {
      where.isPending = filters.isPending;
    }

    if (filters.startDate || filters.endDate) {
      where.txnDate = {};
      if (filters.startDate) {
        where.txnDate.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.txnDate.lte = filters.endDate;
      }
    }

    if (filters.search) {
      where.OR = [
        { description: { contains: filters.search, mode: 'insensitive' } },
        { merchantName: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
  }

  private mapTransaction(transaction: any): Transaction {
    return {
      id: transaction.id,
      userId: transaction.userId,
      accountId: transaction.accountId,
      categoryId: transaction.categoryId,
      type: transaction.type,
      amount: Number(transaction.amount),
      currency: transaction.currency,
      txnDate: transaction.txnDate,
      description: transaction.description,
      merchantName: transaction.merchantName,
      isPending: transaction.isPending,
      isRecurringInstance: transaction.isRecurringInstance,
      source: transaction.source,
      externalId: transaction.externalId,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
    };
  }

  private mapAttachment(attachment: any): Attachment {
    return {
      id: attachment.id,
      transactionId: attachment.transactionId,
      fileUrl: attachment.fileUrl,
      fileType: attachment.fileType,
      fileSize: attachment.fileSize,
      extra: attachment.extra,
      uploadedAt: attachment.uploadedAt,
    };
  }
}