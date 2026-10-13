import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service';

import { CreateTransferInput } from './dto/transfer.dto';
import { Transfer } from '../../common/types/models/transfer.model';
import {
  NotFoundError,
  ValidationError,
  InsufficientBalanceError,
  TransferSameAccountError,
} from '../../common/exceptions/graphql-error.exception';
import {
  TransactionType,
  TransactionSource,
  AccountType,
} from '@finnit/database';
import {
  localToday,
  toLocalDateOnly,
} from '../../common/utils/local-date.util';

@Injectable()
export class TransfersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, input: CreateTransferInput): Promise<Transfer> {
    if (input.fromAccountId === input.toAccountId) {
      throw new TransferSameAccountError();
    }

    // Validate both accounts belong to user
    const [fromAccount, toAccount] = await Promise.all([
      this.prisma.account.findFirst({
        where: { id: input.fromAccountId, userId },
      }),
      this.prisma.account.findFirst({
        where: { id: input.toAccountId, userId },
      }),
    ]);

    if (!fromAccount) {
      throw new NotFoundError('Source account not found');
    }

    if (!toAccount) {
      throw new NotFoundError('Destination account not found');
    }

    // Check if source account has sufficient balance
    if (Number(fromAccount.balanceCurrent) < input.amount) {
      throw new InsufficientBalanceError(
        'Insufficient balance in source account',
      );
    }

    // Check currency compatibility (simplified - in production, you'd handle exchange rates)
    if (fromAccount.currency !== toAccount.currency) {
      throw new ValidationError('Currency conversion not supported yet');
    }

    // The calendar day in the user's time zone (date-only, midnight UTC).
    const txnDate = input.txnDate
      ? toLocalDateOnly(input.txnDate)
      : localToday();
    const description = input.description || `Transfer to ${toAccount.name}`;

    return await this.prisma.$transaction(async (tx) => {
      // Create outgoing transaction
      const fromTxn = await tx.transaction.create({
        data: {
          userId,
          accountId: input.fromAccountId,
          type: TransactionType.transfer,
          amount: input.amount,
          currency: fromAccount.currency,
          txnDate,
          description,
          source: TransactionSource.manual,
        },
      });

      // Create incoming transaction
      const toTxn = await tx.transaction.create({
        data: {
          userId,
          accountId: input.toAccountId,
          type: TransactionType.transfer,
          amount: input.amount,
          currency: toAccount.currency,
          txnDate,
          description,
          source: TransactionSource.manual,
        },
      });

      // Create transfer record
      const transfer = await tx.transfer.create({
        data: {
          fromTxnId: fromTxn.id,
          toTxnId: toTxn.id,
          amount: input.amount,
        },
      });

      // Update account balances
      await Promise.all([
        tx.account.update({
          where: { id: input.fromAccountId },
          data: {
            balanceCurrent: {
              decrement: input.amount,
            },
          },
        }),
        tx.account.update({
          where: { id: input.toAccountId },
          data: {
            balanceCurrent: {
              increment: input.amount,
            },
          },
        }),
      ]);

      // Fetch the complete transfer with transactions
      const completeTransfer = await tx.transfer.findUnique({
        where: { id: transfer.id },
        include: {
          fromTxn: true,
          toTxn: true,
        },
      });

      if (!completeTransfer) {
        throw new Error('Transfer not found after creation');
      }
      return this.mapTransfer(completeTransfer);
    });
  }

  async findById(id: string, userId: string): Promise<Transfer> {
    const transfer = await this.prisma.transfer.findFirst({
      where: {
        id,
        fromTxn: { userId },
      },
      include: {
        fromTxn: {
          include: {
            account: true,
          },
        },
        toTxn: {
          include: {
            account: true,
          },
        },
      },
    });

    if (!transfer) {
      throw new NotFoundError('Transfer not found');
    }

    return this.mapTransfer(transfer);
  }

  async findMany(userId: string): Promise<Transfer[]> {
    const transfers = await this.prisma.transfer.findMany({
      where: {
        fromTxn: { userId },
      },
      include: {
        fromTxn: {
          include: {
            account: true,
          },
        },
        toTxn: {
          include: {
            account: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return transfers.map((transfer) => this.mapTransfer(transfer));
  }

  private mapTransfer(transfer: unknown): Transfer {
    const t = transfer as {
      id: string;
      fromTxnId: string;
      toTxnId: string;
      amount: number;
      createdAt: Date;
      fromTxn: {
        id: string;
        userId: string;
        accountId: string;
        categoryId: string | null;
        type: string;
        amount: number;
        currency: string;
        txnDate: Date;
        description: string | null;
        merchantName: string | null;
        isPending: boolean;
        isRecurringInstance: boolean;
        source: string;
        externalId: string | null;
        createdAt: Date;
        updatedAt: Date;
        account: {
          id: string;
          userId: string;
          type: string;
          name: string;
          currency: string;
          balanceCurrent: number;
          metadata: Record<string, unknown> | null;
          archived: boolean;
          createdAt: Date;
          updatedAt: Date;
        } | null;
      };
      toTxn: {
        id: string;
        userId: string;
        accountId: string;
        categoryId: string | null;
        type: string;
        amount: number;
        currency: string;
        txnDate: Date;
        description: string | null;
        merchantName: string | null;
        isPending: boolean;
        isRecurringInstance: boolean;
        source: string;
        externalId: string | null;
        createdAt: Date;
        updatedAt: Date;
        account: {
          id: string;
          userId: string;
          type: string;
          name: string;
          currency: string;
          balanceCurrent: number;
          metadata: Record<string, unknown> | null;
          archived: boolean;
          createdAt: Date;
          updatedAt: Date;
        } | null;
      };
    };
    return {
      id: t.id,
      fromTxnId: t.fromTxnId,
      toTxnId: t.toTxnId,
      amount: Number(t.amount),
      createdAt: t.createdAt,
      fromTxn: {
        id: t.fromTxn.id,
        userId: t.fromTxn.userId,
        accountId: t.fromTxn.accountId,
        categoryId: t.fromTxn.categoryId ?? undefined,
        type: t.fromTxn.type,
        amount: Number(t.fromTxn.amount),
        currency: t.fromTxn.currency,
        txnDate: t.fromTxn.txnDate,
        description: t.fromTxn.description ?? undefined,
        merchantName: t.fromTxn.merchantName ?? undefined,
        isPending: t.fromTxn.isPending,
        isRecurringInstance: t.fromTxn.isRecurringInstance,
        source: t.fromTxn.source,
        externalId: t.fromTxn.externalId ?? undefined,
        createdAt: t.fromTxn.createdAt,
        updatedAt: t.fromTxn.updatedAt,
        account: t.fromTxn.account
          ? {
              id: t.fromTxn.account.id,
              userId: t.fromTxn.account.userId,
              type: t.fromTxn.account.type as AccountType,
              name: t.fromTxn.account.name,
              currency: t.fromTxn.account.currency,
              balanceCurrent: Number(t.fromTxn.account.balanceCurrent),
              metadata: t.fromTxn.account.metadata || undefined,
              archived: t.fromTxn.account.archived,
              createdAt: t.fromTxn.account.createdAt,
              updatedAt: t.fromTxn.account.updatedAt,
            }
          : undefined,
      },
      toTxn: {
        id: t.toTxn.id,
        userId: t.toTxn.userId,
        accountId: t.toTxn.accountId,
        categoryId: t.toTxn.categoryId ?? undefined,
        type: t.toTxn.type,
        amount: Number(t.toTxn.amount),
        currency: t.toTxn.currency,
        txnDate: t.toTxn.txnDate,
        description: t.toTxn.description ?? undefined,
        merchantName: t.toTxn.merchantName ?? undefined,
        isPending: t.toTxn.isPending,
        isRecurringInstance: t.toTxn.isRecurringInstance,
        source: t.toTxn.source,
        externalId: t.toTxn.externalId ?? undefined,
        createdAt: t.toTxn.createdAt,
        updatedAt: t.toTxn.updatedAt,
        account: t.toTxn.account
          ? {
              id: t.toTxn.account.id,
              userId: t.toTxn.account.userId,
              type: t.toTxn.account.type as AccountType,
              name: t.toTxn.account.name,
              currency: t.toTxn.account.currency,
              balanceCurrent: Number(t.toTxn.account.balanceCurrent),
              metadata: t.toTxn.account.metadata || undefined,
              archived: t.toTxn.account.archived,
              createdAt: t.toTxn.account.createdAt,
              updatedAt: t.toTxn.account.updatedAt,
            }
          : undefined,
      },
    };
  }
}
