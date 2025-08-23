import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service';
import { Transfer, CreateTransferInput } from './dto/transfer.dto';
import { 
  NotFoundError, 
  ValidationError, 
  InsufficientBalanceError,
  TransferSameAccountError,
} from '../../common/exceptions/graphql-error.exception';
import { TransactionType, TransactionSource } from '@finnit/database';

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
      throw new InsufficientBalanceError('Insufficient balance in source account');
    }

    // Check currency compatibility (simplified - in production, you'd handle exchange rates)
    if (fromAccount.currency !== toAccount.currency) {
      throw new ValidationError('Currency conversion not supported yet');
    }

    const txnDate = input.txnDate ? new Date(input.txnDate) : new Date();
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
          description: `${description} (outgoing)`,
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
          description: `${description} (incoming)`,
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
        fromTxn: true,
        toTxn: true,
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
        fromTxn: true,
        toTxn: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return transfers.map(this.mapTransfer);
  }

  private mapTransfer(transfer: any): Transfer {
    return {
      id: transfer.id,
      fromTxnId: transfer.fromTxnId,
      toTxnId: transfer.toTxnId,
      amount: Number(transfer.amount),
      createdAt: transfer.createdAt,
      fromTxn: {
        id: transfer.fromTxn.id,
        userId: transfer.fromTxn.userId,
        accountId: transfer.fromTxn.accountId,
        categoryId: transfer.fromTxn.categoryId,
        type: transfer.fromTxn.type,
        amount: Number(transfer.fromTxn.amount),
        currency: transfer.fromTxn.currency,
        txnDate: transfer.fromTxn.txnDate,
        description: transfer.fromTxn.description,
        merchantName: transfer.fromTxn.merchantName,
        isPending: transfer.fromTxn.isPending,
        isRecurringInstance: transfer.fromTxn.isRecurringInstance,
        source: transfer.fromTxn.source,
        externalId: transfer.fromTxn.externalId,
        createdAt: transfer.fromTxn.createdAt,
        updatedAt: transfer.fromTxn.updatedAt,
      },
      toTxn: {
        id: transfer.toTxn.id,
        userId: transfer.toTxn.userId,
        accountId: transfer.toTxn.accountId,
        categoryId: transfer.toTxn.categoryId,
        type: transfer.toTxn.type,
        amount: Number(transfer.toTxn.amount),
        currency: transfer.toTxn.currency,
        txnDate: transfer.toTxn.txnDate,
        description: transfer.toTxn.description,
        merchantName: transfer.toTxn.merchantName,
        isPending: transfer.toTxn.isPending,
        isRecurringInstance: transfer.toTxn.isRecurringInstance,
        source: transfer.toTxn.source,
        externalId: transfer.toTxn.externalId,
        createdAt: transfer.toTxn.createdAt,
        updatedAt: transfer.toTxn.updatedAt,
      },
    };
  }
}