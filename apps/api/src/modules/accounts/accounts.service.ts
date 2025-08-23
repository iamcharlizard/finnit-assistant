import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service';
import { 
  Account, 
  CreateAccountInput, 
  UpdateAccountInput, 
  AdjustBalanceInput,
  AccountConnection,
  AccountsArgs,
} from './dto/account.dto';
import { NotFoundError, ValidationError, ForbiddenError } from '../../common/exceptions/graphql-error.exception';
import { PaginationUtil } from '../../common/utils/pagination.util';
import { TransactionType, TransactionSource } from '@finnit/database';

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, input: CreateAccountInput): Promise<Account> {
    const account = await this.prisma.account.create({
      data: {
        userId,
        type: input.type,
        name: input.name,
        currency: input.currency,
        balanceCurrent: input.initialBalance,
        metadata: input.metadata,
      },
    });

    // Create initial transaction if balance is not zero
    if (input.initialBalance !== 0) {
      await this.prisma.transaction.create({
        data: {
          userId,
          accountId: account.id,
          type: input.initialBalance > 0 ? TransactionType.income : TransactionType.expense,
          amount: Math.abs(input.initialBalance),
          currency: input.currency,
          txnDate: new Date(),
          description: 'Initial balance',
          source: TransactionSource.manual,
        },
      });
    }

    return this.mapAccount(account);
  }

  async findMany(userId: string, args: AccountsArgs): Promise<AccountConnection> {
    const where: any = { userId };
    
    if (args.type) {
      where.type = args.type;
    }
    
    if (args.archived !== undefined) {
      where.archived = args.archived;
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

    const accounts = await this.prisma.account.findMany({
      where: { ...where, ...cursor },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    const totalCount = await this.prisma.account.count({ where });

    return PaginationUtil.createConnection(
      accounts.map(this.mapAccount),
      args,
      totalCount,
      (account) => PaginationUtil.encodeCursor(account.id),
    );
  }

  async findById(id: string, userId: string): Promise<Account> {
    const account = await this.prisma.account.findFirst({
      where: { id, userId },
    });

    if (!account) {
      throw new NotFoundError('Account not found');
    }

    return this.mapAccount(account);
  }

  async update(id: string, userId: string, input: UpdateAccountInput): Promise<Account> {
    const existingAccount = await this.prisma.account.findFirst({
      where: { id, userId },
    });

    if (!existingAccount) {
      throw new NotFoundError('Account not found');
    }

    const updatedAccount = await this.prisma.account.update({
      where: { id },
      data: input,
    });

    return this.mapAccount(updatedAccount);
  }

  async adjustBalance(userId: string, input: AdjustBalanceInput): Promise<Account> {
    const account = await this.prisma.account.findFirst({
      where: { id: input.accountId, userId },
    });

    if (!account) {
      throw new NotFoundError('Account not found');
    }

    if (input.amount === 0) {
      throw new ValidationError('Adjustment amount cannot be zero');
    }

    return await this.prisma.$transaction(async (tx) => {
      // Create adjustment transaction
      await tx.transaction.create({
        data: {
          userId,
          accountId: account.id,
          type: TransactionType.adjustment,
          amount: Math.abs(input.amount),
          currency: account.currency,
          txnDate: new Date(),
          description: input.description,
          source: TransactionSource.manual,
        },
      });

      // Update account balance
      const updatedAccount = await tx.account.update({
        where: { id: account.id },
        data: {
          balanceCurrent: {
            increment: input.amount,
          },
        },
      });

      return this.mapAccount(updatedAccount);
    });
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const account = await this.prisma.account.findFirst({
      where: { id, userId },
      include: { transactions: true },
    });

    if (!account) {
      throw new NotFoundError('Account not found');
    }

    if (account.transactions.length > 0) {
      throw new ValidationError('Cannot delete account with existing transactions');
    }

    await this.prisma.account.delete({
      where: { id },
    });

    return true;
  }

  private mapAccount(account: any): Account {
    return {
      id: account.id,
      userId: account.userId,
      type: account.type,
      name: account.name,
      currency: account.currency,
      balanceCurrent: Number(account.balanceCurrent),
      metadata: account.metadata,
      archived: account.archived,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }
}