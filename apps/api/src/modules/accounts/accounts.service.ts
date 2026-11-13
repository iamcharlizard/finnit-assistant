import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service';
import {
  CreateAccountInput,
  UpdateAccountInput,
  AdjustBalanceInput,
  SetAccountBalanceInput,
  AccountBalanceHistoryArgs,
  AccountBalanceHistory,
  AccountsBalanceHistoryArgs,
  AccountsBalanceHistory,
  BALANCE_HISTORY_MAX_DAYS,
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
import {
  localToday,
  toLocalDateOnly,
} from '../../common/utils/local-date.util';
import { effectOf } from '../../common/utils/balance-effect.util';
import {
  addDayKeys,
  combineBalances,
  dailyBalances,
  dayKeyOf,
  mainCurrency,
  daysInRange,
  firstCompleteDay,
  type DayKey,
  type DayMovements,
} from './balance-history';

/** A local day ('YYYY-MM-DD') as the date-only value Prisma stores. */
const dateOf = (day: DayKey) => new Date(`${day}T00:00:00.000Z`);
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

/** Default description of the adjustment that sets an account's balance. */
export const BALANCE_UPDATE_DESCRIPTION = 'Balance update';

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
              balanceEffect: input.initialBalance,
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

    if (existingAccount.isDefaultCash && input.archived) {
      throw new ValidationError('The cash account cannot be archived');
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
        ...(input.includeInTotal !== undefined && {
          includeInTotal: input.includeInTotal,
        }),
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
          balanceEffect: input.amount,
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

  /**
   * Sets the balance to what the bank shows. The difference is an
   * adjustment dated today with the signed difference as its balance effect,
   * so it never counts as income or spending. No change, no movement.
   */
  async setBalance(
    userId: string,
    input: SetAccountBalanceInput,
  ): Promise<Account> {
    return this.prisma.$transaction(async (tx) => {
      const account = await tx.account.findFirst({
        where: { id: input.accountId, userId },
      });
      if (!account) throw new NotFoundError('Account not found');

      const balance = Math.round(input.balance * 100) / 100;
      const difference =
        Math.round((balance - Number(account.balanceCurrent)) * 100) / 100;
      if (difference === 0) return this.mapAccount(account);

      await tx.transaction.create({
        data: {
          userId,
          accountId: account.id,
          type: TransactionType.adjustment,
          amount: Math.abs(difference),
          balanceEffect: difference,
          currency: account.currency,
          txnDate: localToday(),
          description: input.description?.trim() || BALANCE_UPDATE_DESCRIPTION,
          source: TransactionSource.manual,
        },
      });
      const updated = await tx.account.update({
        where: { id: account.id },
        data: { balanceCurrent: { increment: difference } },
      });
      return this.mapAccount(updated);
    });
  }

  /**
   * The account's balance on each day from `from` to `to` (today at most),
   * newest first: its current balance minus the effect of every confirmed
   * movement dated after each day.
   */
  async balanceHistory(
    userId: string,
    args: AccountBalanceHistoryArgs,
  ): Promise<AccountBalanceHistory> {
    const account = await this.prisma.account.findFirst({
      where: { id: args.accountId, userId },
      select: {
        id: true,
        currency: true,
        balanceCurrent: true,
        createdAt: true,
        _count: { select: { linkedAccounts: true, transactions: true } },
      },
    });
    if (!account) throw new NotFoundError('Account not found');

    const range = this.rangeDays(args.from, args.to);
    const to = range[0];
    const from = range.at(-1)!;

    const confirmedFrom = {
      accountId: account.id,
      isPending: false,
      cancelledAt: null,
      txnDate: { gte: dateOf(from) },
    };
    const [ins, outs, unknown, oldestImported, lastUnknown] = await Promise.all(
      [
        this.prisma.transaction.groupBy({
          by: ['txnDate'],
          where: { ...confirmedFrom, balanceEffect: { gt: 0 } },
          _sum: { balanceEffect: true },
          _count: { _all: true },
        }),
        this.prisma.transaction.groupBy({
          by: ['txnDate'],
          where: { ...confirmedFrom, balanceEffect: { lt: 0 } },
          _sum: { balanceEffect: true },
          _count: { _all: true },
        }),
        // Old adjustments without a recorded direction count as before.
        this.prisma.transaction.findMany({
          where: { ...confirmedFrom, balanceEffect: null },
          select: {
            txnDate: true,
            type: true,
            amount: true,
            balanceEffect: true,
          },
        }),
        account._count.linkedAccounts > 0
          ? this.prisma.transaction.aggregate({
              where: {
                accountId: account.id,
                source: { not: TransactionSource.manual },
              },
              _min: { txnDate: true },
            })
          : null,
        this.prisma.transaction.aggregate({
          where: { accountId: account.id, balanceEffect: null },
          _max: { txnDate: true },
        }),
      ],
    );

    const byDay = new Map<DayKey, DayMovements>();
    const add = (date: Date, effect: number, count: number) => {
      const day = dayKeyOf(date);
      const moves = byDay.get(day) ?? { inflow: 0, outflow: 0, count: 0 };
      if (effect > 0) moves.inflow += effect;
      else moves.outflow += effect;
      moves.count += count;
      byDay.set(day, moves);
    };
    for (const row of [...ins, ...outs]) {
      add(row.txnDate, Number(row._sum.balanceEffect ?? 0), row._count._all);
    }
    for (const row of unknown) add(row.txnDate, effectOf(row), 1);

    const oldest = oldestImported?._min.txnDate;
    const completeFrom = firstCompleteDay({
      hasMovements: account._count.transactions > 0,
      createdOn: dayKeyOf(toLocalDateOnly(account.createdAt)),
      oldestImported: oldest ? dayKeyOf(oldest) : null,
      lastUnknownEffect: lastUnknown._max.txnDate
        ? dayKeyOf(lastUnknown._max.txnDate)
        : null,
    });

    const days = dailyBalances({
      current: Number(account.balanceCurrent),
      byDay,
      from,
      to,
      completeFrom,
    });
    return {
      accountId: account.id,
      currency: account.currency,
      completeFrom: dateOf(completeFrom),
      days: days.map((day) => ({ ...day, date: dateOf(day.date) })),
    };
  }

  /**
   * Every (not archived) account in one currency that adds up to the
   * total, day by day: money available and card debt, from each account's
   * own history.
   */
  async allBalanceHistory(
    userId: string,
    args: AccountsBalanceHistoryArgs,
  ): Promise<AccountsBalanceHistory> {
    const accounts = await this.prisma.account.findMany({
      where: { userId, archived: false, includeInTotal: true },
      select: { id: true, type: true, currency: true },
      orderBy: { createdAt: 'asc' },
    });
    const currency = mainCurrency(
      accounts.map((a) => a.currency),
      args.currency,
    );
    const included = accounts.filter((a) => a.currency === currency);
    const histories = await Promise.all(
      included.map(async (account) => ({
        isCredit: account.type === AccountType.credit,
        history: await this.balanceHistory(userId, {
          accountId: account.id,
          from: args.from,
          to: args.to,
        }),
      })),
    );

    // With no accounts there are still days (all zero).
    const dates = histories[0]
      ? histories[0].history.days.map((d) => dayKeyOf(d.date))
      : this.rangeDays(args.from, args.to);
    const days = combineBalances(
      histories.map(({ isCredit, history }) => ({
        isCredit,
        days: history.days.map((d) => ({ ...d, date: dayKeyOf(d.date) })),
      })),
      dates,
    );
    return {
      currency: currency ?? undefined,
      accounts: included.length,
      days: days.map((day) => ({ ...day, date: dateOf(day.date) })),
    };
  }

  /** The days of a range (today at most), newest first; validated. */
  private rangeDays(fromDate: Date, toDate: Date): DayKey[] {
    const today = dayKeyOf(localToday());
    const from = dayKeyOf(toLocalDateOnly(fromDate));
    const requestedTo = dayKeyOf(toLocalDateOnly(toDate));
    const to = requestedTo > today ? today : requestedTo;
    const span = daysInRange(from, to);
    if (span === 0) {
      throw new ValidationError('The first day must not be after the last');
    }
    if (span > BALANCE_HISTORY_MAX_DAYS) {
      throw new ValidationError(
        `At most ${BALANCE_HISTORY_MAX_DAYS} days at a time`,
      );
    }
    return Array.from({ length: span }, (_, i) => addDayKeys(to, -i));
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const account = await this.prisma.account.findFirst({
      where: { id, userId },
      include: { transactions: true },
    });

    if (!account) {
      throw new NotFoundError('Account not found');
    }

    if (account.isDefaultCash) {
      throw new ValidationError('The cash account cannot be deleted');
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
      isDefaultCash: account.isDefaultCash,
      includeInTotal: account.includeInTotal,
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
      isDefaultCash: account.isDefaultCash,
      includeInTotal: account.includeInTotal,
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
