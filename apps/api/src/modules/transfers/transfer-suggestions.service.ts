import { Injectable } from '@nestjs/common';
import {
  AliasMatchType,
  CategorySource,
  Prisma,
  TransferSuggestionReason,
  TransferSuggestionStatus,
} from '@finnit/database';

import { PrismaService } from '../../services/prisma.service';
import {
  NotFoundError,
  ValidationError,
} from '../../common/exceptions/graphql-error.exception';
import { PaginationUtil } from '../../common/utils/pagination.util';
import { effectOf } from '../../common/utils/balance-effect.util';
import {
  TRANSACTION_PRESENTATION_INCLUDE,
  mapTransaction,
} from '../transactions/transaction.mapper';
import { MerchantAliasesService } from '../categorization/merchant-aliases.service';
import { MerchantRulesService } from '../categorization/merchant-rules.service';
import {
  FREE_MOVEMENT,
  TransferConversionService,
} from './transfer-conversion.service';
import { CONVERTIBLE_TYPES } from './transfer-matching';
import { aliasPatternFor, looksLikeTransfer } from './transfer-detection';
import {
  ResolveTransferSuggestionInput,
  TransferSuggestion,
  TransferSuggestionAction,
  TransferSuggestionConnection,
  TransferSuggestionsArgs,
} from './dto/transfer-suggestion.dto';
import { visibleCategoryWhere } from '../categories/category-scope';

const PENDING = TransferSuggestionStatus.pending;

const MOVEMENT_INCLUDE = {
  ...TRANSACTION_PRESENTATION_INCLUDE,
  account: true,
  category: true,
} satisfies Prisma.TransactionInclude;

const SUGGESTION_INCLUDE = {
  transaction: { include: MOVEMENT_INCLUDE },
  counterpartTransaction: { include: MOVEMENT_INCLUDE },
} satisfies Prisma.TransferSuggestionInclude;

type SuggestionRow = Prisma.TransferSuggestionGetPayload<{
  include: typeof SUGGESTION_INCLUDE;
}>;

/**
 * Bank movements that look like transfers between the user's own accounts.
 * They are only suggested: the user confirms each one (it becomes a
 * transfer), says it went to someone else, or dismisses it, and a reviewed
 * movement is never suggested again.
 */
@Injectable()
export class TransferSuggestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conversion: TransferConversionService,
    private readonly aliases: MerchantAliasesService,
    private readonly rules: MerchantRulesService,
  ) {}

  /**
   * Looks at newly arrived movements. A movement whose opposite is the only
   * one of its amount in another own account is suggested with it (pair);
   * one an alias sends to an account, with that account (rule); one that
   * only reads like a transfer, alone (text). Returns how many were added.
   */
  async detect(userId: string, transactionIds: string[]): Promise<number> {
    if (transactionIds.length === 0) return 0;
    const rows = await this.prisma.transaction.findMany({
      where: {
        id: { in: transactionIds },
        userId,
        type: { in: [...CONVERTIBLE_TYPES] },
        ...FREE_MOVEMENT,
        transferSuggestion: { is: null },
        transferSuggestionMatches: { none: { status: { not: PENDING } } },
      },
      select: {
        id: true,
        accountId: true,
        merchantName: true,
        description: true,
        aliasId: true,
        alias: { select: { transferAccountId: true } },
      },
      orderBy: [{ txnDate: 'asc' }, { createdAt: 'asc' }],
    });

    // Movements already in a suggestion (as either side).
    const taken = new Set<string>();
    let added = 0;
    for (const row of rows) {
      if (taken.has(row.id) || (await this.inPendingSuggestion(row.id))) {
        continue;
      }
      const ruleAccountId = row.alias?.transferAccountId ?? null;
      const candidates = (
        await this.conversion.candidates(userId, row.id, ruleAccountId)
      ).filter((candidate) => !taken.has(candidate.id));

      // The other side arrived earlier and was suggested alone: now it has
      // its pair.
      const waiting =
        candidates.length === 1
          ? await this.prisma.transferSuggestion.findFirst({
              where: {
                transactionId: candidates[0].id,
                status: PENDING,
                counterpartTransactionId: null,
              },
              select: { id: true },
            })
          : null;
      if (waiting) {
        await this.prisma.transferSuggestion.update({
          where: { id: waiting.id },
          data: {
            reason: TransferSuggestionReason.pair,
            counterpartTransactionId: row.id,
            counterpartAccountId: row.accountId,
          },
        });
        taken.add(row.id).add(candidates[0].id);
        continue;
      }

      const single =
        candidates.length === 1 &&
        !(await this.inPendingSuggestion(candidates[0].id))
          ? candidates[0]
          : null;
      let reason: TransferSuggestionReason;
      if (ruleAccountId) reason = TransferSuggestionReason.rule;
      else if (single) reason = TransferSuggestionReason.pair;
      // A text-only guess, unless an alias already says what it is.
      else if (
        !row.aliasId &&
        looksLikeTransfer(row.merchantName, row.description)
      ) {
        reason = TransferSuggestionReason.text;
      } else continue;

      await this.prisma.transferSuggestion.create({
        data: {
          userId,
          transactionId: row.id,
          reason,
          counterpartTransactionId: single?.id ?? null,
          counterpartAccountId: ruleAccountId ?? single?.accountId ?? null,
        },
      });
      taken.add(row.id);
      if (single) taken.add(single.id);
      added += 1;
    }
    return added;
  }

  /** Pending suggestions, newest first. */
  async list(
    userId: string,
    args: TransferSuggestionsArgs,
  ): Promise<TransferSuggestionConnection> {
    const limit = args.first ?? 20;
    const where = { userId, status: PENDING };
    const [rows, totalCount] = await Promise.all([
      this.prisma.transferSuggestion.findMany({
        where,
        include: SUGGESTION_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        ...(args.after && {
          cursor: { id: PaginationUtil.decodeCursor(args.after) },
          skip: 1,
        }),
      }),
      this.prisma.transferSuggestion.count({ where }),
    ]);
    const connection = PaginationUtil.createConnection(
      rows.slice(0, limit).map((row) => this.map(row)),
      { first: limit, after: args.after ?? undefined },
      totalCount,
      (suggestion) => PaginationUtil.encodeCursor(suggestion.id),
    );
    connection.pageInfo.hasNextPage = rows.length > limit;
    return connection;
  }

  /** How many are waiting for the user. */
  pendingCount(userId: string): Promise<number> {
    return this.prisma.transferSuggestion.count({
      where: { userId, status: PENDING },
    });
  }

  async resolve(
    userId: string,
    id: string,
    input: ResolveTransferSuggestionInput,
  ): Promise<boolean> {
    const suggestion = await this.prisma.transferSuggestion.findFirst({
      where: { id, userId },
      include: SUGGESTION_INCLUDE,
    });
    if (!suggestion) throw new NotFoundError('Suggestion not found');
    if (suggestion.status !== PENDING) {
      throw new ValidationError('This suggestion was already reviewed');
    }
    const movement = suggestion.transaction;
    const text = movement.merchantName ?? movement.description;
    const pattern =
      input.pattern?.trim() || aliasPatternFor(text) || (text ?? '').trim();

    switch (input.action) {
      case TransferSuggestionAction.to_account: {
        const accountId = input.accountId ?? suggestion.counterpartAccountId;
        if (!accountId) {
          throw new ValidationError('Choose the account it went to');
        }
        const counterpartTransactionId =
          input.counterpartTransactionId !== undefined
            ? input.counterpartTransactionId
            : suggestion.counterpartTransaction?.accountId === accountId
              ? suggestion.counterpartTransactionId
              : null;
        await this.conversion.convert(userId, {
          transactionId: movement.id,
          counterpartAccountId: accountId,
          counterpartTransactionId,
        });
        if (input.remember && pattern) {
          const account = await this.prisma.account.findFirst({
            where: { id: accountId, userId },
            select: { name: true, metadata: true },
          });
          const nickname = (
            account?.metadata as { nickname?: string | null } | null
          )?.nickname?.trim();
          await this.aliases.create(userId, {
            matchType: AliasMatchType.contains,
            pattern,
            displayName: transferAliasName(
              await this.localeOf(userId),
              nickname || account?.name || '',
              effectOf(movement) < 0 ? 'out' : 'in',
            ),
            transferAccountId: accountId,
          });
        }
        return true;
      }
      case TransferSuggestionAction.to_someone: {
        const description = input.description?.trim() || null;
        const categoryId = input.categoryId || null;
        if (categoryId) await this.ensureCategory(userId, categoryId);
        await this.prisma.$transaction(async (tx) => {
          await tx.transaction.update({
            where: { id: movement.id },
            data: {
              ...(description && { aliasName: description }),
              ...(categoryId && {
                categoryId,
                categorySource: CategorySource.manual,
                suggestedCategoryId: null,
                suggestedBy: null,
              }),
            },
          });
          await tx.transferSuggestion.update({
            where: { id },
            data: { status: TransferSuggestionStatus.dismissed },
          });
        });
        if (input.remember && pattern) {
          if (description) {
            await this.aliases.create(userId, {
              matchType: AliasMatchType.contains,
              pattern,
              displayName: description,
              categoryId,
            });
          } else if (categoryId) {
            await this.rules.learn(this.prisma, userId, [{ text, categoryId }]);
          }
        }
        return true;
      }
      case TransferSuggestionAction.dismiss:
        await this.prisma.transferSuggestion.update({
          where: { id },
          data: { status: TransferSuggestionStatus.dismissed },
        });
        return true;
    }
  }

  private async inPendingSuggestion(transactionId: string): Promise<boolean> {
    const found = await this.prisma.transferSuggestion.findFirst({
      where: {
        status: PENDING,
        OR: [{ transactionId }, { counterpartTransactionId: transactionId }],
      },
      select: { id: true },
    });
    return found !== null;
  }

  private async ensureCategory(userId: string, id: string): Promise<void> {
    const category = await this.prisma.category.findFirst({
      where: { id, ...visibleCategoryWhere(userId) },
      select: { id: true },
    });
    if (!category) throw new NotFoundError('Category not found');
  }

  private async localeOf(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { locale: true },
    });
    return user?.locale ?? 'es';
  }

  private map(row: SuggestionRow): TransferSuggestion {
    const text = row.transaction.merchantName ?? row.transaction.description;
    return {
      id: row.id,
      reason: row.reason,
      transaction: mapTransaction(row.transaction),
      counterpartTransaction: row.counterpartTransaction
        ? mapTransaction(row.counterpartTransaction)
        : null,
      counterpartAccountId: row.counterpartAccountId,
      suggestedPattern:
        aliasPatternFor(text) || (text ?? '').trim().slice(0, 200),
      createdAt: row.createdAt,
    };
  }
}

/** The name an alias "these go to my account X" gives its movements. */
export function transferAliasName(
  locale: string,
  account: string,
  direction: 'in' | 'out',
): string {
  if (locale === 'en') {
    return direction === 'out'
      ? `Transfer to ${account}`
      : `Transfer from ${account}`;
  }
  return direction === 'out'
    ? `Transferencia a ${account}`
    : `Transferencia desde ${account}`;
}
