import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  S3StorageService,
  type StoredObject,
} from '../storage/s3-storage.service';
import { detectFileType, safeFileName } from '../storage/file-type.util';

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_TRANSACTION = 10;
const SIMILAR_AMOUNT_TOLERANCE = 0.01;
const SIMILAR_DAYS_WINDOW = 3;
const SIMILAR_MAX_RESULTS = 5;
const MAX_CATEGORY_DEPTH = 5;
const toCents = (value: number) => Math.round(value * 100) / 100;
import { PrismaService } from '../../services/prisma.service';
import {
  CreateTransactionInput,
  UpdateTransactionInput,
  TransactionsArgs,
  TransactionFilters,
  SimilarTransactionsArgs,
} from './dto/transaction.dto';
import {
  TransactionRecurringPayment,
  TransferCounterpart,
} from './dto/transaction-links.dto';
import {
  NotFoundError,
  ValidationError,
} from '../../common/exceptions/graphql-error.exception';
import { PaginationUtil } from '../../common/utils/pagination.util';
import { addDays, toLocalDateOnly } from '../../common/utils/local-date.util';
import { TransactionSource } from '@finnit/database';
import { Prisma } from '@finnit/database';
import { Attachment } from '../../common/types/models/attachment.model';
import {
  Transaction,
  TransactionConnection,
} from '../../common/types/models/transaction.model';
import { CategorySource } from '@finnit/database';
import { MerchantAliasesService } from '../categorization/merchant-aliases.service';
import {
  MerchantRulesService,
  ruleText,
} from '../categorization/merchant-rules.service';
import { TransactionAliasInput } from '../categorization/dto/merchant-alias.dto';
import { MAX_ALIAS_NAME_LENGTH } from '../categorization/dto/merchant-alias.dto';
import {
  TRANSACTION_PRESENTATION_INCLUDE,
  mapAttachment,
  mapTransaction,
} from './transaction.mapper';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: S3StorageService,
    private readonly aliases: MerchantAliasesService,
    private readonly rules: MerchantRulesService,
  ) {}

  /**
   * `options.within` runs inside the same database transaction, after the
   * movement is inserted (e.g. a confirmed receipt attaches its photo), so
   * both are saved or neither is.
   */
  async create(
    userId: string,
    input: CreateTransactionInput,
    options: {
      source?: TransactionSource;
      within?: (
        tx: Prisma.TransactionClient,
        created: Prisma.TransactionGetPayload<Record<string, never>>,
      ) => Promise<void>;
    } = {},
  ): Promise<Transaction> {
    // Validate account belongs to user
    const account = await this.prisma.account.findFirst({
      where: { id: input.accountId, userId },
    });

    if (!account) {
      throw new NotFoundError('Account not found');
    }

    // The user's category, else a merchant rule, else the frequency guess.
    const { categoryId, categorySource } = input.categoryId
      ? { categoryId: input.categoryId, categorySource: CategorySource.manual }
      : await this.autoCategory(userId, input);

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

    const created = await this.prisma.$transaction(async (tx) => {
      // Create transaction
      const transaction = await tx.transaction.create({
        data: {
          userId,
          accountId: input.accountId,
          categoryId,
          categorySource,
          type: input.type,
          amount: input.amount,
          currency: input.currency,
          txnDate: toLocalDateOnly(input.txnDate),
          description: input.description,
          merchantName: input.merchantName,
          isPending: input.isPending || false,
          source: options.source ?? TransactionSource.manual,
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

      await options.within?.(tx, transaction);
      return transaction;
    });

    await this.aliases.applyTo(userId, [created.id]);
    return this.reload(created);
  }

  async findMany(
    userId: string,
    args: TransactionsArgs,
  ): Promise<TransactionConnection> {
    const where: Prisma.TransactionWhereInput = { userId };

    if (args.filters) {
      await this.applyFilters(userId, where, args.filters);
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
        ...TRANSACTION_PRESENTATION_INCLUDE,
      },
    });

    const hasMore = rows.length > limit;
    const transactions = backward
      ? rows.slice(hasMore ? 1 : 0)
      : rows.slice(0, limit);
    const totalCount = await this.prisma.transaction.count({ where });

    const connection = PaginationUtil.createConnection(
      transactions.map((transaction) => mapTransaction(transaction)),
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
        account: true,
        category: true,
        ...TRANSACTION_PRESENTATION_INCLUDE,
      },
    });

    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }

    // The detail reveals the original text of private movements ("ver original").
    return mapTransaction(transaction, { reveal: true });
  }

  /**
   * One-off display name and/or privacy for a single movement (feature 17),
   * without creating an alias rule. The original text is never modified.
   */
  async setAlias(
    id: string,
    userId: string,
    input: TransactionAliasInput,
  ): Promise<Transaction> {
    const existing = await this.prisma.transaction.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundError('Transaction not found');

    const data: Prisma.TransactionUpdateInput = {};
    if (input.displayName !== undefined) {
      const name = input.displayName?.trim() ?? '';
      if (name.length > MAX_ALIAS_NAME_LENGTH) {
        throw new ValidationError(
          `The display name must have at most ${MAX_ALIAS_NAME_LENGTH} characters`,
        );
      }
      data.aliasName = name || null;
    }
    if (input.isPrivate !== undefined && input.isPrivate !== null) {
      data.isPrivate = input.isPrivate;
    }
    const updated = await this.prisma.transaction.update({
      where: { id },
      data,
      include: TRANSACTION_PRESENTATION_INCLUDE,
    });
    return mapTransaction(updated);
  }

  async update(
    id: string,
    userId: string,
    input: UpdateTransactionInput,
  ): Promise<Transaction> {
    const existingTransaction = await this.prisma.transaction.findFirst({
      where: { id, userId },
      include: {
        transferFrom: { select: { id: true } },
        transferTo: { select: { id: true } },
      },
    });

    if (!existingTransaction) {
      throw new NotFoundError('Transaction not found');
    }

    // Movements from the bank or a statement keep the bank's data; only the
    // category is the user's (the name is changed with an alias).
    if (existingTransaction.source !== TransactionSource.manual) {
      const changed = (
        Object.keys(input) as (keyof UpdateTransactionInput)[]
      ).filter((key) => key !== 'categoryId' && input[key] !== undefined);
      if (changed.length > 0) {
        throw new ValidationError(
          'Cannot modify imported transactions; only the category can change',
        );
      }
    }

    // One side's amount alone would leave the transfer unbalanced.
    if (
      (existingTransaction.transferFrom || existingTransaction.transferTo) &&
      input.amount !== undefined &&
      input.amount !== Number(existingTransaction.amount)
    ) {
      throw new ValidationError(
        'Cannot change the amount of a transfer; delete it and create it again',
      );
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

    const updated = await this.prisma.$transaction(async (tx) => {
      // The balance only reflects confirmed transactions: undo the old effect
      // and apply the new one (amount and/or pending state may change).
      const sign = existingTransaction.type === 'income' ? 1 : -1;
      const oldEffect = existingTransaction.isPending
        ? 0
        : sign * Number(existingTransaction.amount);
      const newEffect =
        (input.isPending ?? existingTransaction.isPending)
          ? 0
          : sign * (input.amount ?? Number(existingTransaction.amount));
      const balanceChange = newEffect - oldEffect;

      if (balanceChange !== 0) {
        await tx.account.update({
          where: { id: existingTransaction.accountId },
          data: {
            balanceCurrent: {
              increment: balanceChange,
            },
          },
        });
      }

      return tx.transaction.update({
        where: { id },
        data: {
          ...input,
          ...(input.txnDate && { txnDate: toLocalDateOnly(input.txnDate) }),
          // A category chosen by the user replaces any pending suggestion.
          ...(input.categoryId && {
            categorySource: CategorySource.manual,
            suggestedCategoryId: null,
            suggestedBy: null,
          }),
        },
      });
    });

    // A new merchant/description may match a different alias.
    if (input.merchantName !== undefined || input.description !== undefined) {
      await this.aliases.applyTo(userId, [id]);
    }
    return this.reload(updated);
  }

  /** The other side of a transfer movement, or null when it isn't one. */
  async findTransferCounterpart(
    id: string,
    userId: string,
  ): Promise<TransferCounterpart | null> {
    const side = {
      select: {
        id: true,
        accountId: true,
        account: { select: { name: true, metadata: true } },
      },
    } as const;
    const transfer = await this.prisma.transfer.findFirst({
      where: {
        OR: [{ fromTxnId: id }, { toTxnId: id }],
        fromTxn: { userId },
      },
      select: { fromTxnId: true, fromTxn: side, toTxn: side },
    });
    if (!transfer) return null;
    const isSource = transfer.fromTxnId === id;
    const other = isSource ? transfer.toTxn : transfer.fromTxn;
    const nickname = (
      other.account.metadata as { nickname?: string | null } | null
    )?.nickname?.trim();
    return {
      transactionId: other.id,
      accountId: other.accountId,
      accountName: nickname || other.account.name,
      direction: isSource ? 'out' : 'in',
    };
  }

  /** The recurring payment this movement paid, if any. */
  async findRecurringPayment(
    id: string,
    userId: string,
  ): Promise<TransactionRecurringPayment | null> {
    const occurrence = await this.prisma.recurringOccurrence.findFirst({
      where: { transactionId: id, recurringExpense: { userId } },
      select: {
        id: true,
        dueDate: true,
        recurringExpense: { select: { id: true, name: true } },
      },
    });
    if (!occurrence) return null;
    return {
      occurrenceId: occurrence.id,
      recurringExpenseId: occurrence.recurringExpense.id,
      name: occurrence.recurringExpense.name,
      dueDate: occurrence.dueDate,
    };
  }

  /**
   * The user's transactions in the account that look like the one about to
   * be created (same amount within a cent, within 3 days of its local day),
   * newest first. Lets the create flow warn about duplicates.
   */
  async findSimilar(
    userId: string,
    args: SimilarTransactionsArgs,
  ): Promise<Transaction[]> {
    const day = toLocalDateOnly(args.date);
    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        accountId: args.accountId,
        ...(args.type && { type: args.type }),
        amount: {
          gte: toCents(args.amount - SIMILAR_AMOUNT_TOLERANCE),
          lte: toCents(args.amount + SIMILAR_AMOUNT_TOLERANCE),
        },
        txnDate: {
          gte: addDays(day, -SIMILAR_DAYS_WINDOW),
          lte: addDays(day, SIMILAR_DAYS_WINDOW),
        },
      },
      orderBy: [{ txnDate: 'desc' }, { createdAt: 'desc' }],
      take: SIMILAR_MAX_RESULTS,
      include: TRANSACTION_PRESENTATION_INCLUDE,
    });
    return transactions.map((transaction) => mapTransaction(transaction));
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
      return mapAttachment(attachment);
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

    const created = await this.prisma.$transaction(async (tx) => {
      const results: Prisma.TransactionGetPayload<Record<string, never>>[] = [];

      for (const input of transactions) {
        const { categoryId, categorySource } = input.categoryId
          ? {
              categoryId: input.categoryId,
              categorySource: CategorySource.manual,
            }
          : await this.autoCategory(userId, input);

        const transaction = await tx.transaction.create({
          data: {
            userId,
            accountId: input.accountId,
            categoryId,
            categorySource,
            type: input.type,
            amount: input.amount,
            currency: input.currency,
            txnDate: toLocalDateOnly(input.txnDate),
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

        results.push(transaction);
      }

      return results;
    });

    await this.aliases.applyTo(
      userId,
      created.map((transaction) => transaction.id),
    );
    const rows = await this.prisma.transaction.findMany({
      where: { id: { in: created.map((transaction) => transaction.id) } },
      include: TRANSACTION_PRESENTATION_INCLUDE,
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    return created.map((transaction) =>
      mapTransaction(byId.get(transaction.id) ?? transaction),
    );
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
      data: {
        categoryId,
        categorySource: CategorySource.manual,
        suggestedCategoryId: null,
        suggestedBy: null,
      },
      include: TRANSACTION_PRESENTATION_INCLUDE,
    });

    return mapTransaction(updatedTransaction);
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
        include: TRANSACTION_PRESENTATION_INCLUDE,
      });

      return mapTransaction(updatedTransaction);
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

  /**
   * Category for a new movement the user did not categorize: a merchant
   * rule first, then the most frequent category of similar merchants.
   */
  private async autoCategory(
    userId: string,
    input: { merchantName?: string | null; description?: string | null },
  ): Promise<{ categoryId?: string; categorySource?: CategorySource }> {
    const ruleCategory = await this.rules.categoryFor(userId, ruleText(input));
    if (ruleCategory) {
      return { categoryId: ruleCategory, categorySource: CategorySource.rule };
    }
    if (input.merchantName) {
      const guess = await this.suggestCategoryForMerchant(
        userId,
        input.merchantName,
      );
      if (guess) {
        return { categoryId: guess.id, categorySource: CategorySource.rule };
      }
    }
    return {};
  }

  /** Reads a movement again with its alias and suggestion (after aliases ran). */
  private async reload(
    row: Prisma.TransactionGetPayload<Record<string, never>>,
  ): Promise<Transaction> {
    const fresh = await this.prisma.transaction.findUnique({
      where: { id: row.id },
      include: TRANSACTION_PRESENTATION_INCLUDE,
    });
    return mapTransaction(fresh ?? row);
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

  private async applyFilters(
    userId: string,
    where: Prisma.TransactionWhereInput,
    filters: TransactionFilters,
  ): Promise<void> {
    if (filters.accountId) {
      where.accountId = filters.accountId;
    }

    if (filters.categoryId) {
      // A parent category includes its subcategories.
      const ids = await this.categoryWithDescendants(
        userId,
        filters.categoryId,
      );
      where.categoryId = ids.length === 1 ? ids[0] : { in: ids };
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

    if (filters.uncategorized !== undefined && filters.uncategorized !== null) {
      // Overrides categoryId: "uncategorized" means no category at all.
      where.categoryId = filters.uncategorized ? null : { not: null };
    }

    if (filters.hasSuggestion !== undefined && filters.hasSuggestion !== null) {
      where.suggestedCategoryId = filters.hasSuggestion ? { not: null } : null;
    }

    if (filters.search?.trim()) {
      where.OR = this.searchConditions(filters.search.trim());
    }
  }

  /**
   * Search matches what the user sees (the display name: one-off alias, else
   * the alias rule) and the original text only when the movement is not
   * private, so a private movement is never found by its original text.
   */
  private searchConditions(search: string): Prisma.TransactionWhereInput[] {
    const contains = { contains: search, mode: 'insensitive' as const };
    return [
      { aliasName: contains },
      { aliasName: null, alias: { is: { displayName: contains } } },
      {
        isPrivate: false,
        OR: [{ aliasId: null }, { alias: { is: { isPrivate: false } } }],
        AND: [{ OR: [{ description: contains }, { merchantName: contains }] }],
      },
    ];
  }

  /** The category and every subcategory below it visible to the user. */
  private async categoryWithDescendants(
    userId: string,
    categoryId: string,
  ): Promise<string[]> {
    const ids = [categoryId];
    let level = [categoryId];
    for (let depth = 0; depth < MAX_CATEGORY_DEPTH && level.length; depth++) {
      const children = await this.prisma.category.findMany({
        where: {
          parentId: { in: level },
          OR: [{ userId }, { userId: null }],
        },
        select: { id: true },
      });
      level = children.map((c) => c.id).filter((id) => !ids.includes(id));
      ids.push(...level);
    }
    return ids;
  }
}
