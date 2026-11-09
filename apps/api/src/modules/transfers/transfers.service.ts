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
  Prisma,
  TransactionType,
  TransactionSource,
  TransferSuggestionStatus,
  AccountType,
} from '@finnit/database';
import { Transaction } from '../../common/types/models/transaction.model';
import { effectOf, moveBalance } from '../../common/utils/balance-effect.util';
import { addDays } from '../../common/utils/local-date.util';
import { FREE_MOVEMENT } from './free-movement';
import { COUNTERPART_TYPES } from './transfer-matching';
import {
  becomeSide,
  dissolveTransfer,
  requireTransfer,
  transferOfMovement,
} from './transfer-dissolve';
import {
  localToday,
  toLocalDateOnly,
} from '../../common/utils/local-date.util';
import {
  TRANSACTION_PRESENTATION_INCLUDE,
  mapTransaction,
  presentationFields,
} from '../transactions/transaction.mapper';

/** A new transfer looks for its sides this many days around its date. */
export const LEG_DAYS_WINDOW = 3;

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

    // Check currency compatibility (simplified - in production, you'd handle exchange rates)
    if (fromAccount.currency !== toAccount.currency) {
      throw new ValidationError('Currency conversion not supported yet');
    }

    return await this.prisma.$transaction(async (tx) => {
      // Movements already recorded become the sides (no new money moves).
      const existingFrom = input.fromTransactionId
        ? await this.existingSide(tx, userId, input.fromTransactionId, {
            accountId: fromAccount.id,
            amount: input.amount,
            direction: 'out',
          })
        : null;
      const existingTo = input.toTransactionId
        ? await this.existingSide(tx, userId, input.toTransactionId, {
            accountId: toAccount.id,
            amount: input.amount,
            direction: 'in',
          })
        : null;

      // Only money that still has to leave the source must be there.
      if (!existingFrom && Number(fromAccount.balanceCurrent) < input.amount) {
        throw new InsufficientBalanceError(
          'Insufficient balance in source account',
        );
      }

      // The calendar day in the user's time zone (date-only, midnight UTC);
      // without one, the day of a side already recorded.
      const txnDate = input.txnDate
        ? toLocalDateOnly(input.txnDate)
        : (existingFrom?.txnDate ?? existingTo?.txnDate ?? localToday());
      const description = input.description || `Transfer to ${toAccount.name}`;

      const sideId = async (
        existing: Parameters<typeof becomeSide>[1] | null,
        account: { id: string; currency: string },
        effect: number,
      ): Promise<string> => {
        if (existing) {
          await becomeSide(tx, existing);
          return existing.id;
        }
        const created = await tx.transaction.create({
          data: {
            userId,
            accountId: account.id,
            type: TransactionType.transfer,
            amount: input.amount,
            balanceEffect: effect,
            currency: account.currency,
            txnDate,
            description,
            source: TransactionSource.manual,
          },
          select: { id: true },
        });
        await moveBalance(tx, account.id, effect);
        return created.id;
      };

      const fromTxnId = await sideId(existingFrom, fromAccount, -input.amount);
      const toTxnId = await sideId(existingTo, toAccount, input.amount);

      const transfer = await tx.transfer.create({
        data: {
          fromTxnId,
          toTxnId,
          amount: input.amount,
          // Made from a recorded movement: undoing it gives it back.
          ...((existingFrom || existingTo) && { convertedAt: new Date() }),
        },
      });
      await tx.transferSuggestion.updateMany({
        where: {
          userId,
          transactionId: { in: [fromTxnId, toTxnId] },
          status: TransferSuggestionStatus.pending,
        },
        data: { status: TransferSuggestionStatus.accepted },
      });

      // Fetch the complete transfer with transactions
      const completeTransfer = await tx.transfer.findUnique({
        where: { id: transfer.id },
        include: {
          fromTxn: {
            include: { alias: TRANSACTION_PRESENTATION_INCLUDE.alias },
          },
          toTxn: { include: { alias: TRANSACTION_PRESENTATION_INCLUDE.alias } },
        },
      });

      if (!completeTransfer) {
        throw new Error('Transfer not found after creation');
      }
      return this.mapTransfer(completeTransfer);
    });
  }

  /**
   * Movements already recorded that may be the sides of a new transfer:
   * free expenses/income (or a card payment's adjustment) of this amount, a
   * few days around `date`, leaving the source and arriving at the
   * destination. Closest date first.
   */
  async legCandidates(
    userId: string,
    args: {
      fromAccountId: string;
      toAccountId: string;
      amount: number;
      date?: Date | null;
    },
  ): Promise<{ from: Transaction[]; to: Transaction[] }> {
    const day = args.date ? toLocalDateOnly(args.date) : localToday();
    const rows = await this.prisma.transaction.findMany({
      where: {
        userId,
        ...FREE_MOVEMENT,
        accountId: { in: [args.fromAccountId, args.toAccountId] },
        type: { in: [...COUNTERPART_TYPES] },
        amount: { gte: args.amount - 0.01, lte: args.amount + 0.01 },
        txnDate: {
          gte: addDays(day, -LEG_DAYS_WINDOW),
          lte: addDays(day, LEG_DAYS_WINDOW),
        },
      },
      include: { ...TRANSACTION_PRESENTATION_INCLUDE, account: true },
      take: 40,
    });
    const distance = (date: Date) => Math.abs(date.getTime() - day.getTime());
    const pick = (accountId: string, sign: number) =>
      rows
        .filter(
          (row) =>
            row.accountId === accountId && Math.sign(effectOf(row)) === sign,
        )
        .sort(
          (a, b) =>
            distance(a.txnDate) - distance(b.txnDate) ||
            a.id.localeCompare(b.id),
        )
        .slice(0, 5)
        .map((row) => mapTransaction(row));
    return {
      from: pick(args.fromAccountId, -1),
      to: pick(args.toAccountId, 1),
    };
  }

  /**
   * Deletes a transfer: sides that existed before (converted, or from the
   * bank) go back to being expenses/income; sides it created are deleted
   * with their balance.
   */
  async delete(userId: string, transferId: string): Promise<boolean> {
    await this.prisma.$transaction(async (tx) => {
      const transfer = requireTransfer(
        await transferOfMovement(tx, { id: transferId, fromTxn: { userId } }),
      );
      await dissolveTransfer(tx, transfer);
    });
    return true;
  }

  /** A recorded movement checked to fit as one side of a new transfer. */
  private async existingSide(
    tx: Prisma.TransactionClient,
    userId: string,
    id: string,
    want: { accountId: string; amount: number; direction: 'in' | 'out' },
  ) {
    const row = await tx.transaction.findFirst({
      where: { id, userId, ...FREE_MOVEMENT },
      select: {
        id: true,
        accountId: true,
        type: true,
        amount: true,
        balanceEffect: true,
        txnDate: true,
      },
    });
    if (!row) throw new NotFoundError('Movement not found or already linked');
    const effect = effectOf(row);
    if (
      row.accountId !== want.accountId ||
      !COUNTERPART_TYPES.includes(row.type) ||
      Math.abs(Number(row.amount) - want.amount) > 0.01 ||
      (want.direction === 'out' ? effect >= 0 : effect <= 0)
    ) {
      throw new ValidationError(
        "That movement doesn't match this side of the transfer",
      );
    }
    return row;
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
            alias: TRANSACTION_PRESENTATION_INCLUDE.alias,
          },
        },
        toTxn: {
          include: {
            account: true,
            alias: TRANSACTION_PRESENTATION_INCLUDE.alias,
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
            alias: TRANSACTION_PRESENTATION_INCLUDE.alias,
          },
        },
        toTxn: {
          include: {
            account: true,
            alias: TRANSACTION_PRESENTATION_INCLUDE.alias,
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
      convertedAt?: Date | null;
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
        inProcess?: boolean;
        isRecurringInstance: boolean;
        source: string;
        externalId: string | null;
        createdAt: Date;
        updatedAt: Date;
        aliasId?: string | null;
        aliasName?: string | null;
        isPrivate?: boolean;
        alias?: { displayName: string; isPrivate: boolean } | null;
        account: {
          id: string;
          userId: string;
          type: string;
          name: string;
          currency: string;
          balanceCurrent: number;
          metadata: Record<string, unknown> | null;
          archived: boolean;
          isDefaultCash?: boolean;
          includeInTotal?: boolean;
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
        inProcess?: boolean;
        isRecurringInstance: boolean;
        source: string;
        externalId: string | null;
        createdAt: Date;
        updatedAt: Date;
        aliasId?: string | null;
        aliasName?: string | null;
        isPrivate?: boolean;
        alias?: { displayName: string; isPrivate: boolean } | null;
        account: {
          id: string;
          userId: string;
          type: string;
          name: string;
          currency: string;
          balanceCurrent: number;
          metadata: Record<string, unknown> | null;
          archived: boolean;
          isDefaultCash?: boolean;
          includeInTotal?: boolean;
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
      convertedAt: t.convertedAt ?? null,
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
        inProcess: t.fromTxn.inProcess ?? false,
        isRecurringInstance: t.fromTxn.isRecurringInstance,
        source: t.fromTxn.source,
        externalId: t.fromTxn.externalId ?? undefined,
        createdAt: t.fromTxn.createdAt,
        updatedAt: t.fromTxn.updatedAt,
        ...presentationFields(t.fromTxn),
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
              isDefaultCash: t.fromTxn.account.isDefaultCash ?? false,
              includeInTotal: t.fromTxn.account.includeInTotal ?? true,
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
        inProcess: t.toTxn.inProcess ?? false,
        isRecurringInstance: t.toTxn.isRecurringInstance,
        source: t.toTxn.source,
        externalId: t.toTxn.externalId ?? undefined,
        createdAt: t.toTxn.createdAt,
        updatedAt: t.toTxn.updatedAt,
        ...presentationFields(t.toTxn),
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
              isDefaultCash: t.toTxn.account.isDefaultCash ?? false,
              includeInTotal: t.toTxn.account.includeInTotal ?? true,
              createdAt: t.toTxn.account.createdAt,
              updatedAt: t.toTxn.account.updatedAt,
            }
          : undefined,
      },
    };
  }
}
