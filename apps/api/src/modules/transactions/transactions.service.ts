import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  S3StorageService,
  type StoredObject,
} from '../storage/s3-storage.service';
import { detectFileType, safeFileName } from '../storage/file-type.util';

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_TRANSACTION = 10;
import { PrismaService } from '../../services/prisma.service';
import {
  CreateTransactionInput,
  UpdateTransactionInput,
  TransactionsArgs,
  TransactionFilters,
} from './dto/transaction.dto';
import {
  NotFoundError,
  ValidationError,
} from '../../common/exceptions/graphql-error.exception';
import { PaginationUtil } from '../../common/utils/pagination.util';
import { TransactionSource } from '@finnit/database';
import { Prisma } from '@finnit/database';
import { Attachment } from '../../common/types/models/attachment.model';
import {
  Transaction,
  TransactionConnection,
} from '../../common/types/models/transaction.model';
import { AccountMetadata } from '../../common/types/models/account-metadata.model';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: S3StorageService,
  ) {}

  async create(
    userId: string,
    input: CreateTransactionInput,
  ): Promise<Transaction> {
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
      const suggestedCategory = await this.suggestCategoryForMerchant(
        userId,
        input.merchantName,
      );
      categoryId = suggestedCategory?.id;
    }

    // Validate category belongs to user (if provided)
    if (categoryId) {
      const category = await this.prisma.category.findFirst({
        where: {
          id: categoryId,
          OR: [{ userId }, { userId: null, isDefault: true }],
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
        const balanceChange =
          input.type === 'income' ? input.amount : -input.amount;
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

  async findMany(
    userId: string,
    args: TransactionsArgs,
  ): Promise<TransactionConnection> {
    const where: Prisma.TransactionWhereInput = { userId };

    if (args.filters) {
      this.applyFilters(where, args.filters);
    }

    // Keyset pagination in the list's order (newest first, id breaks ties),
    // so pages never skip or repeat rows. One extra row tells whether more
    // remain in the direction of travel.
    const limit = args.first || args.last || 20;
    const backward = !args.first && !args.after && Boolean(args.before);
    const cursorId = args.after ?? args.before;

    const rows = await this.prisma.transaction.findMany({
      where,
      orderBy: [{ txnDate: 'desc' }, { id: 'desc' }],
      take: backward ? -(limit + 1) : limit + 1,
      ...(cursorId && {
        cursor: { id: PaginationUtil.decodeCursor(cursorId) },
        skip: 1,
      }),
      include: {
        account: true,
        category: true,
        attachments: true,
      },
    });

    const hasMore = rows.length > limit;
    const transactions = backward
      ? rows.slice(hasMore ? 1 : 0)
      : rows.slice(0, limit);
    const totalCount = await this.prisma.transaction.count({ where });

    const connection = PaginationUtil.createConnection(
      transactions.map((transaction) =>
        this.mapTransactionWithRelations(transaction),
      ),
      args,
      totalCount,
      (transaction) => PaginationUtil.encodeCursor(transaction.id),
    );
    connection.pageInfo.hasNextPage = backward ? true : hasMore;
    connection.pageInfo.hasPreviousPage = backward ? hasMore : !!cursorId;
    return connection;
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

    return {
      ...this.mapTransaction(transaction),
      attachments: transaction.attachments.map((a) => this.mapAttachment(a)),
    };
  }

  async update(
    id: string,
    userId: string,
    input: UpdateTransactionInput,
  ): Promise<Transaction> {
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
          OR: [{ userId }, { userId: null, isDefault: true }],
        },
      });

      if (!category) {
        throw new NotFoundError('Category not found');
      }
    }

    return await this.prisma.$transaction(async (tx) => {
      // Calculate balance adjustment if amount changed
      if (input.amount && input.amount !== Number(existingTransaction.amount)) {
        const oldAmount =
          existingTransaction.type === 'income'
            ? Number(existingTransaction.amount)
            : -Number(existingTransaction.amount);
        const newAmount =
          existingTransaction.type === 'income' ? input.amount : -input.amount;
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
      throw new ValidationError(
        'Cannot delete transaction that is part of a transfer',
      );
    }

    if (transaction.debtPayment) {
      throw new ValidationError(
        'Cannot delete transaction that is a debt payment',
      );
    }

    if (transaction.goalContributions.length > 0) {
      throw new ValidationError(
        'Cannot delete transaction that has goal contributions',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // Adjust account balance
      if (!transaction.isPending) {
        const balanceChange =
          transaction.type === 'income'
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

  /**
   * Stores a receipt/invoice in the private bucket and attaches it to the
   * user's transaction. The type comes from the file's bytes, not the name.
   */
  async uploadAttachment(
    userId: string,
    transactionId: string,
    file: { buffer: Buffer; size: number; originalname?: string },
  ): Promise<Attachment> {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      throw new ValidationError('The file exceeds 10 MB');
    }
    const type = detectFileType(file.buffer);
    if (!type) {
      throw new ValidationError(
        'Only PDF, JPEG, PNG, WEBP or HEIC files are allowed',
      );
    }
    const transaction = await this.prisma.transaction.findFirst({
      where: { id: transactionId, userId },
      select: { id: true, _count: { select: { attachments: true } } },
    });
    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }
    if (transaction._count.attachments >= MAX_ATTACHMENTS_PER_TRANSACTION) {
      throw new ValidationError(
        `A transaction can have at most ${MAX_ATTACHMENTS_PER_TRANSACTION} attachments`,
      );
    }

    const id = randomUUID();
    const fileKey = S3StorageService.key(
      userId,
      'attachments',
      id,
      type.extension,
    );
    await this.storage.put(fileKey, file.buffer, type.mime);
    try {
      const attachment = await this.prisma.attachment.create({
        data: {
          id,
          transactionId,
          fileKey,
          fileName: safeFileName(
            file.originalname,
            `adjunto.${type.extension}`,
          ),
          fileType: type.mime,
          fileSize: file.size,
        },
      });
      return this.mapAttachment(attachment);
    } catch (error) {
      await this.storage.delete(fileKey);
      throw error;
    }
  }

  /** The attachment's file, only for the owner of the transaction. */
  async openAttachment(
    id: string,
    userId: string,
  ): Promise<{ file: StoredObject; fileName: string; fileType: string }> {
    const attachment = await this.prisma.attachment.findFirst({
      where: { id, transaction: { userId } },
    });
    if (!attachment?.fileKey) {
      throw new NotFoundError('Attachment not found');
    }
    return {
      file: await this.storage.open(attachment.fileKey),
      fileName: attachment.fileName ?? `adjunto-${id}`,
      fileType: attachment.fileType,
    };
  }

  async removeAttachment(id: string, userId: string): Promise<boolean> {
    const attachment = await this.prisma.attachment.findFirst({
      where: { id, transaction: { userId } },
    });

    if (!attachment) {
      throw new NotFoundError('Attachment not found');
    }

    await this.prisma.attachment.delete({ where: { id } });
    if (attachment.fileKey) await this.storage.delete(attachment.fileKey);
    return true;
  }

  async bulkCreate(
    userId: string,
    transactions: CreateTransactionInput[],
  ): Promise<Transaction[]> {
    if (transactions.length === 0) {
      return [];
    }

    // Validate all accounts belong to user
    const accountIds = [...new Set(transactions.map((t) => t.accountId))];
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
          const suggestedCategory = await this.suggestCategoryForMerchant(
            userId,
            input.merchantName,
          );
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
          const balanceChange =
            input.type === 'income' ? input.amount : -input.amount;
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

  async recategorizeTransaction(
    id: string,
    userId: string,
    categoryId: string,
  ): Promise<Transaction> {
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
        OR: [{ userId }, { userId: null, isDefault: true }],
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

  async markAsPending(
    id: string,
    userId: string,
    isPending: boolean,
  ): Promise<Transaction> {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, userId },
    });

    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }

    return await this.prisma.$transaction(async (tx) => {
      // Adjust account balance based on pending status change
      if (transaction.isPending !== isPending) {
        const balanceChange =
          transaction.type === 'income'
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
    dateTo: Date,
  ): Promise<{
    totalIncome: number;
    totalExpenses: number;
    netCashFlow: number;
    transactionCount: number;
  }> {
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

  private async suggestCategoryForMerchant(
    userId: string,
    merchantName: string,
  ): Promise<{ id: string } | null> {
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
        categoryCount[txn.categoryId] =
          (categoryCount[txn.categoryId] || 0) + 1;
      }
    }

    // Find the most common category
    const mostCommonCategoryId = Object.keys(categoryCount).reduce(
      (maxId, currentId) =>
        categoryCount[currentId] > (categoryCount[maxId] || 0)
          ? currentId
          : maxId,
      Object.keys(categoryCount)[0],
    );

    return mostCommonCategoryId ? { id: mostCommonCategoryId } : null;
  }

  private applyFilters(
    where: Prisma.TransactionWhereInput,
    filters: TransactionFilters,
  ): void {
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

  private mapTransaction(
    transaction: Prisma.TransactionGetPayload<Record<string, never>>,
  ): Transaction {
    return {
      id: transaction.id,
      userId: transaction.userId,
      accountId: transaction.accountId,
      categoryId: transaction.categoryId || undefined,
      type: transaction.type,
      amount: Number(transaction.amount),
      currency: transaction.currency,
      txnDate: transaction.txnDate,
      description: transaction.description || undefined,
      merchantName: transaction.merchantName || undefined,
      isPending: transaction.isPending,
      isRecurringInstance: transaction.isRecurringInstance,
      source: transaction.source,
      externalId: transaction.externalId || undefined,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
    };
  }

  private mapTransactionWithRelations(
    transaction: Prisma.TransactionGetPayload<{
      include: { account: true; category: true; attachments: true };
    }>,
  ): Transaction {
    return {
      id: transaction.id,
      userId: transaction.userId,
      accountId: transaction.accountId,
      categoryId: transaction.categoryId || undefined,
      type: transaction.type,
      amount: Number(transaction.amount),
      currency: transaction.currency,
      txnDate: transaction.txnDate,
      description: transaction.description || undefined,
      merchantName: transaction.merchantName || undefined,
      isPending: transaction.isPending,
      isRecurringInstance: transaction.isRecurringInstance,
      source: transaction.source,
      externalId: transaction.externalId || undefined,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
      account: transaction.account
        ? {
            id: transaction.account.id,
            userId: transaction.account.userId,
            type: transaction.account.type,
            name: transaction.account.name,
            currency: transaction.account.currency,
            balanceCurrent: Number(transaction.account.balanceCurrent),
            metadata: transaction.account.metadata as AccountMetadata,
            archived: transaction.account.archived,
            createdAt: transaction.account.createdAt,
            updatedAt: transaction.account.updatedAt,
          }
        : undefined,
      category: transaction.category
        ? {
            id: transaction.category.id,
            userId: transaction.category.userId || undefined,
            parentId: transaction.category.parentId || undefined,
            name: transaction.category.name,
            isDefault: transaction.category.isDefault,
            sortOrder: transaction.category.sortOrder || undefined,
            createdAt: transaction.category.createdAt,
          }
        : undefined,
      attachments:
        transaction.attachments?.map((attachment) =>
          this.mapAttachment(attachment),
        ) ?? [],
    };
  }

  private mapAttachment(
    attachment: Prisma.AttachmentGetPayload<Record<string, never>>,
  ): Attachment {
    return {
      id: attachment.id,
      transactionId: attachment.transactionId,
      fileName: attachment.fileName ?? undefined,
      fileType: attachment.fileType,
      fileSize: attachment.fileSize ?? undefined,
      downloadPath: attachment.fileKey
        ? `/attachments/${attachment.id}/file`
        : undefined,
      uploadedAt: attachment.uploadedAt,
    };
  }
}
