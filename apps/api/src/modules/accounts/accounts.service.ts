import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service';
import {
  CreateAccountInput,
  UpdateAccountInput,
  AdjustBalanceInput,
  AccountConnection,
  AccountsArgs,
  CreditCardTermsInput,
} from './dto/account.dto';
import {
  ConflictError,
  InvalidAccountTypeError,
  NotFoundError,
  ValidationError,
} from '../../common/exceptions/graphql-error.exception';
import { KeysetPage } from '../../common/utils/keyset-pagination.util';
import { localToday } from '../../common/utils/local-date.util';
import {
  AccountType,
  TransactionType,
  TransactionSource,
} from '@finnit/database';
import { Prisma } from '@finnit/database';
import { Account } from '../../common/types/models/account.model';
import {
  AccountDesignInput,
  AccountMetadata,
  AccountMetadataInput,
  HEX_COLOR,
  NICKNAME_MAX_LENGTH,
} from '../../common/types/models/account-metadata.model';

/** Description of the adjustment that records an account's opening balance. */
export const OPENING_BALANCE_DESCRIPTION = 'Initial balance';

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, input: CreateAccountInput): Promise<Account> {
    const metadata = this.mergeMetadata(undefined, input.metadata);

    // The account and its opening balance are created together. The opening
    // balance is an adjustment, so it never counts as income or spending.
    return await this.prisma
      .$transaction(async (tx) => {
        const account = await tx.account.create({
          data: {
            userId,
            type: input.type,
            name: input.name,
            currency: input.currency,
            balanceCurrent: input.initialBalance,
            ...(metadata && { metadata }),
          },
        });

        if (input.initialBalance !== 0) {
          await tx.transaction.create({
            data: {
              userId,
              accountId: account.id,
              type: TransactionType.adjustment,
              amount: Math.abs(input.initialBalance),
              currency: input.currency,
              txnDate: localToday(),
              description: OPENING_BALANCE_DESCRIPTION,
              source: TransactionSource.manual,
            },
          });
        }

        return this.mapAccount(account);
      })
      .catch((error: unknown) => {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new ConflictError('An account with this name already exists');
        }
        throw error;
      });
  }

  async findMany(
    userId: string,
    args: AccountsArgs,
  ): Promise<AccountConnection> {
    const where: Prisma.AccountWhereInput = { userId };

    if (args.type) {
      where.type = args.type;
    }

    if (args.archived !== undefined) {
      where.archived = args.archived;
    }

    // Newest first; the cursor resolves to (createdAt, id).
    const page = new KeysetPage(args);
    const accounts = await this.prisma.account.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...page.query,
      include: { creditCardTerms: true },
    });

    const totalCount = await this.prisma.account.count({ where });

    return page.toConnection(accounts, totalCount, (account) =>
      this.mapAccountWithCreditCardTerms(account),
    );
  }

  async findById(id: string, userId: string): Promise<Account> {
    const account = await this.prisma.account.findFirst({
      where: { id, userId },
      include: {
        creditCardTerms: true,
      },
    });

    if (!account) {
      throw new NotFoundError('Account not found');
    }

    return this.mapAccountWithCreditCardTerms(account);
  }

  async update(
    id: string,
    userId: string,
    input: UpdateAccountInput,
  ): Promise<Account> {
    const existingAccount = await this.prisma.account.findFirst({
      where: { id, userId },
    });

    if (!existingAccount) {
      throw new NotFoundError('Account not found');
    }

    // Merge, so fields set by the bank sync survive a personalization.
    const metadata = input.metadata
      ? this.mergeMetadata(existingAccount.metadata, input.metadata)
      : undefined;

    const updatedAccount = await this.prisma.account.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.archived !== undefined && { archived: input.archived }),
        ...(metadata && { metadata }),
      },
    });

    return this.mapAccount(updatedAccount);
  }

  async adjustBalance(
    userId: string,
    input: AdjustBalanceInput,
  ): Promise<Account> {
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
          txnDate: localToday(),
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
      throw new ValidationError(
        'Cannot delete account with existing transactions',
      );
    }

    await this.prisma.account.delete({
      where: { id },
    });

    return true;
  }

  async setCreditCardTerms(
    accountId: string,
    userId: string,
    input: CreditCardTermsInput,
  ): Promise<Account> {
    await this.findCreditAccount(accountId, userId);
    validateCreditCardTerms(input);

    const terms = {
      statementDay: input.statementDay,
      paymentDueDay: input.paymentDueDay,
      interestRateAnnual: input.interestRateAnnual ?? null,
      minPaymentRule: input.minPaymentRule ?? null,
      gracePeriodDays: input.gracePeriodDays ?? null,
    };
    await this.prisma.creditCardTerms.upsert({
      where: { accountId },
      create: { accountId, ...terms },
      update: terms,
    });

    return this.findById(accountId, userId);
  }

  async removeCreditCardTerms(
    accountId: string,
    userId: string,
  ): Promise<Account> {
    await this.findCreditAccount(accountId, userId);
    await this.prisma.creditCardTerms.deleteMany({ where: { accountId } });
    return this.findById(accountId, userId);
  }

  private async findCreditAccount(accountId: string, userId: string) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId },
    });
    if (!account) {
      throw new NotFoundError('Account not found');
    }
    if (account.type !== AccountType.credit) {
      throw new InvalidAccountTypeError(
        'Credit card terms only apply to credit accounts',
      );
    }
    return account;
  }

  /**
   * The stored metadata with `input` applied on top: omitted fields are
   * kept, `null` removes a field. Validates the personalization fields.
   */
  private mergeMetadata(
    current: Prisma.JsonValue | undefined,
    input?: AccountMetadataInput,
  ): Prisma.InputJsonObject | undefined {
    if (!input) return undefined;
    validateMetadataInput(input);

    const merged: Record<string, unknown> =
      current && typeof current === 'object' && !Array.isArray(current)
        ? { ...current }
        : {};
    for (const [key, value] of Object.entries(input)) {
      if (value === undefined) continue;
      if (value === null) {
        delete merged[key];
      } else if (key === 'nickname') {
        merged[key] = (value as string).trim();
      } else if (key === 'design') {
        const design = value as AccountDesignInput;
        merged[key] = {
          primaryColor: design.primaryColor,
          ...(design.secondaryColor && {
            secondaryColor: design.secondaryColor,
          }),
        };
      } else {
        merged[key] = value;
      }
    }
    return merged as Prisma.InputJsonObject;
  }

  private mapAccount(
    account: Prisma.AccountGetPayload<Record<string, never>>,
  ): Account {
    return {
      id: account.id,
      userId: account.userId,
      type: account.type,
      name: account.name,
      currency: account.currency,
      balanceCurrent: Number(account.balanceCurrent),
      metadata: account.metadata
        ? (account.metadata as AccountMetadata)
        : undefined,
      archived: account.archived,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }

  private mapAccountWithCreditCardTerms(
    account: Prisma.AccountGetPayload<{
      include: { creditCardTerms: true };
    }>,
  ): Account {
    return {
      id: account.id,
      userId: account.userId,
      type: account.type,
      name: account.name,
      currency: account.currency,
      balanceCurrent: Number(account.balanceCurrent),
      metadata: account.metadata
        ? (account.metadata as AccountMetadata)
        : undefined,
      archived: account.archived,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      creditCardTerms: account.creditCardTerms
        ? {
            accountId: account.creditCardTerms.accountId,
            statementDay: account.creditCardTerms.statementDay,
            paymentDueDay: account.creditCardTerms.paymentDueDay,
            interestRateAnnual:
              account.creditCardTerms.interestRateAnnual != null
                ? Number(account.creditCardTerms.interestRateAnnual)
                : undefined,
            minPaymentRule: account.creditCardTerms.minPaymentRule || undefined,
            gracePeriodDays:
              account.creditCardTerms.gracePeriodDays ?? undefined,
            updatedAt: account.creditCardTerms.updatedAt,
          }
        : undefined,
    };
  }
}

function validateMetadataInput(input: AccountMetadataInput): void {
  if (input.nickname != null) {
    const nickname = input.nickname.trim();
    if (nickname.length < 1 || nickname.length > NICKNAME_MAX_LENGTH) {
      throw new ValidationError(
        `The nickname must be 1 to ${NICKNAME_MAX_LENGTH} characters`,
      );
    }
  }
  if (input.design != null) {
    const { primaryColor, secondaryColor } = input.design;
    if (!HEX_COLOR.test(primaryColor ?? '')) {
      throw new ValidationError('primaryColor must be a #RRGGBB hex color');
    }
    if (secondaryColor != null && !HEX_COLOR.test(secondaryColor)) {
      throw new ValidationError('secondaryColor must be a #RRGGBB hex color');
    }
  }
}

function validateCreditCardTerms(input: CreditCardTermsInput): void {
  const isDay = (day: number) => Number.isInteger(day) && day >= 1 && day <= 31;
  if (!isDay(input.statementDay) || !isDay(input.paymentDueDay)) {
    throw new ValidationError(
      'statementDay and paymentDueDay must be days of the month (1 to 31)',
    );
  }
  if (
    input.interestRateAnnual != null &&
    !(input.interestRateAnnual >= 0 && input.interestRateAnnual <= 200)
  ) {
    throw new ValidationError('interestRateAnnual must be between 0 and 200');
  }
  if (
    input.gracePeriodDays != null &&
    !(
      Number.isInteger(input.gracePeriodDays) &&
      input.gracePeriodDays >= 0 &&
      input.gracePeriodDays <= 90
    )
  ) {
    throw new ValidationError('gracePeriodDays must be between 0 and 90');
  }
}
