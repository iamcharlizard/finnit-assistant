import { Injectable, Logger } from '@nestjs/common';
import { AliasMatchType, Prisma } from '@finnit/database';
import { PrismaService } from '../../services/prisma.service';
import {
  NotFoundError,
  ValidationError,
} from '../../common/exceptions/graphql-error.exception';
import { mapCategory } from '../transactions/transaction.mapper';
import {
  AliasPreview,
  MAX_ALIAS_NAME_LENGTH,
  MAX_ALIAS_PATTERN_LENGTH,
  MerchantAlias,
  MerchantAliasInput,
} from './dto/merchant-alias.dto';
import {
  AliasPreviewRow,
  previewAliasSql,
  recomputeAliasesSql,
  regexCheckSql,
} from './merchant-alias.sql';

/** Aliases per user (each recompute evaluates all of them per movement). */
export const MAX_ALIASES_PER_USER = 200;
/** Cap for a statement that evaluates user patterns. */
export const ALIAS_STATEMENT_TIMEOUT = '5s';

const POSTGRES_QUERY_CANCELED = '57014';

type Db = Prisma.TransactionClient | PrismaService;

interface ValidAlias {
  matchType: AliasMatchType;
  pattern: string;
  displayName: string;
  categoryId: string | null;
  isPrivate: boolean;
  priority: number;
  active: boolean;
}

const aliasInclude = {
  category: true,
  _count: { select: { transactions: true } },
} satisfies Prisma.MerchantAliasInclude;

/**
 * Merchant aliases (feature 17): display names, optional category and
 * privacy for movements whose original text matches a pattern. The match is
 * materialized in Transaction.aliasId, recomputed in one SQL statement when
 * the user's aliases change and applied to new movements as they arrive.
 */
@Injectable()
export class MerchantAliasesService {
  private readonly logger = new Logger(MerchantAliasesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<MerchantAlias[]> {
    const rows = await this.prisma.merchantAlias.findMany({
      where: { userId },
      include: aliasInclude,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map((row) => this.map(row));
  }

  async create(
    userId: string,
    input: MerchantAliasInput,
  ): Promise<MerchantAlias> {
    const data = await this.validate(userId, input);
    const count = await this.prisma.merchantAlias.count({ where: { userId } });
    if (count >= MAX_ALIASES_PER_USER) {
      throw new ValidationError(
        `You can have at most ${MAX_ALIASES_PER_USER} aliases`,
      );
    }
    const id = await this.inRecompute(userId, async (tx) => {
      const row = await tx.merchantAlias.create({ data: { userId, ...data } });
      return row.id;
    });
    return this.findOne(userId, id);
  }

  async update(
    userId: string,
    id: string,
    input: MerchantAliasInput,
  ): Promise<MerchantAlias> {
    await this.ensureOwned(userId, id);
    const data = await this.validate(userId, input);
    await this.inRecompute(userId, (tx) =>
      tx.merchantAlias.update({ where: { id }, data }),
    );
    return this.findOne(userId, id);
  }

  async delete(userId: string, id: string): Promise<boolean> {
    await this.ensureOwned(userId, id);
    // The FK clears aliasId; the recompute lets a lower-priority alias match.
    await this.inRecompute(userId, (tx) =>
      tx.merchantAlias.delete({ where: { id } }),
    );
    return true;
  }

  /** What a candidate alias would match, without saving anything. */
  async preview(
    userId: string,
    input: MerchantAliasInput,
  ): Promise<AliasPreview> {
    const { matchType, pattern } = await this.validate(userId, input, {
      preview: true,
    });
    const rows = await this.prisma.$transaction(async (tx) => {
      await this.limitStatementTime(tx);
      return tx.$queryRaw<AliasPreviewRow[]>(
        previewAliasSql(userId, matchType, pattern),
      );
    });
    return {
      count: rows.length ? Number(rows[0].total) : 0,
      samples: rows.map((row) => ({
        transactionId: row.id,
        original: row.original,
        date: row.txnDate,
        amount: Number(row.amount),
        currency: row.currency,
      })),
    };
  }

  /**
   * Applies the user's aliases to new movements (manual, statement or bank
   * imports). Runs in the caller's transaction when given one, inside a
   * savepoint: a failure is logged and never undoes the import.
   */
  async applyTo(
    userId: string,
    transactionIds: string[],
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    if (transactionIds.length === 0) return;
    const hasAliases = await (tx ?? this.prisma).merchantAlias.count({
      where: { userId, active: true },
    });
    if (!hasAliases) return;
    try {
      if (tx) {
        await tx.$executeRawUnsafe('SAVEPOINT apply_aliases');
        try {
          await this.limitStatementTime(tx);
          await tx.$executeRaw(recomputeAliasesSql(userId, transactionIds));
          await tx.$executeRawUnsafe('SET LOCAL statement_timeout TO DEFAULT');
          await tx.$executeRawUnsafe('RELEASE SAVEPOINT apply_aliases');
        } catch (error) {
          await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT apply_aliases');
          throw error;
        }
      } else {
        await this.prisma.$transaction(async (client) => {
          await this.limitStatementTime(client);
          await client.$executeRaw(recomputeAliasesSql(userId, transactionIds));
        });
      }
    } catch (error) {
      this.logger.warn(
        `Aliases not applied to ${transactionIds.length} movements: ${(error as Error).message}`,
      );
    }
  }

  /** Validates and normalizes the input (category ownership, regex compiles in Postgres). */
  async validate(
    userId: string,
    input: MerchantAliasInput,
    { preview = false } = {},
  ): Promise<ValidAlias> {
    const pattern = input.pattern?.trim() ?? '';
    const displayName = input.displayName?.trim() ?? '';
    if (!Object.values(AliasMatchType).includes(input.matchType)) {
      throw new ValidationError('Unknown match type');
    }
    if (!pattern || pattern.length > MAX_ALIAS_PATTERN_LENGTH) {
      throw new ValidationError(
        `The pattern must have 1 to ${MAX_ALIAS_PATTERN_LENGTH} characters`,
      );
    }
    // The preview runs while the user is still typing the name.
    if (
      (!preview && !displayName) ||
      displayName.length > MAX_ALIAS_NAME_LENGTH
    ) {
      throw new ValidationError(
        `The display name must have 1 to ${MAX_ALIAS_NAME_LENGTH} characters`,
      );
    }
    if (input.categoryId && !preview) {
      const category = await this.prisma.category.findFirst({
        where: {
          id: input.categoryId,
          OR: [{ userId }, { userId: null, isDefault: true }],
        },
        select: { id: true },
      });
      if (!category) throw new NotFoundError('Category not found');
    }
    if (input.matchType === AliasMatchType.regex) {
      await this.checkRegex(pattern);
    }
    return {
      matchType: input.matchType,
      pattern,
      displayName,
      categoryId: input.categoryId || null,
      isPrivate: input.isPrivate ?? false,
      priority: input.priority ?? 0,
      active: input.active ?? true,
    };
  }

  private async checkRegex(pattern: string): Promise<void> {
    try {
      await this.prisma.$queryRaw(regexCheckSql(pattern));
    } catch (error) {
      if (/regular expression/i.test((error as Error).message ?? '')) {
        throw new ValidationError('Invalid regular expression');
      }
      throw error;
    }
  }

  /** Runs the change and the full recompute in one transaction, with a time cap. */
  private async inRecompute<T>(
    userId: string,
    change: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const result = await change(tx);
          await this.limitStatementTime(tx);
          await tx.$executeRaw(recomputeAliasesSql(userId));
          return result;
        },
        { timeout: 20_000 },
      );
    } catch (error) {
      if (isQueryCanceled(error)) {
        throw new ValidationError(
          'The pattern takes too long to evaluate; simplify it',
        );
      }
      throw error;
    }
  }

  private async limitStatementTime(db: Db): Promise<void> {
    await db.$executeRawUnsafe(
      `SET LOCAL statement_timeout = '${ALIAS_STATEMENT_TIMEOUT}'`,
    );
  }

  private async ensureOwned(userId: string, id: string): Promise<void> {
    const alias = await this.prisma.merchantAlias.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!alias) throw new NotFoundError('Alias not found');
  }

  private async findOne(userId: string, id: string): Promise<MerchantAlias> {
    const row = await this.prisma.merchantAlias.findFirst({
      where: { id, userId },
      include: aliasInclude,
    });
    if (!row) throw new NotFoundError('Alias not found');
    return this.map(row);
  }

  private map(
    row: Prisma.MerchantAliasGetPayload<{ include: typeof aliasInclude }>,
  ): MerchantAlias {
    return {
      id: row.id,
      matchType: row.matchType,
      pattern: row.pattern,
      displayName: row.displayName,
      category: row.category ? mapCategory(row.category) : null,
      isPrivate: row.isPrivate,
      priority: row.priority,
      active: row.active,
      matchCount: row._count.transactions,
      createdAt: row.createdAt,
    };
  }
}

function isQueryCanceled(error: unknown): boolean {
  const err = error as {
    code?: string;
    meta?: { code?: string };
    message?: string;
  };
  return (
    err?.meta?.code === POSTGRES_QUERY_CANCELED ||
    err?.code === POSTGRES_QUERY_CANCELED ||
    /statement timeout|canceling statement/i.test(err?.message ?? '')
  );
}
