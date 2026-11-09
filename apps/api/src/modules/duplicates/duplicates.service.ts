import { Injectable } from '@nestjs/common';
import {
  DuplicateSuggestionStatus,
  Prisma,
  TransactionSource,
  TransactionType,
} from '@finnit/database';

import { PrismaService } from '../../services/prisma.service';
import {
  NotFoundError,
  ValidationError,
} from '../../common/exceptions/graphql-error.exception';
import { effectOf } from '../../common/utils/balance-effect.util';
import { addDays } from '../../common/utils/local-date.util';
import { removeMovement } from '../../common/utils/remove-movement.util';
import { Transaction } from '../../common/types/models/transaction.model';
import { becomeSide } from '../transfers/transfer-dissolve';
import {
  TRANSACTION_PRESENTATION_INCLUDE,
  mapTransaction,
  presentTransaction,
} from '../transactions/transaction.mapper';
import {
  DuplicateAction,
  DuplicateSuggestionConnection,
  MergeNameFrom,
  type DuplicateSuggestion,
} from './dto/duplicate.dto';

/** Two records of the same money land this close. */
export const DUPLICATE_DAYS_WINDOW = 3;
const AMOUNT_TOLERANCE = 0.01;

const MERGE_SELECT = {
  id: true,
  userId: true,
  accountId: true,
  type: true,
  amount: true,
  balanceEffect: true,
  isPending: true,
  createdAt: true,
  txnDate: true,
  source: true,
  originalType: true,
  categoryId: true,
  categorySource: true,
  notes: true,
  aliasName: true,
  isPrivate: true,
  merchantName: true,
  description: true,
  alias: TRANSACTION_PRESENTATION_INCLUDE.alias,
  transferFrom: { select: { id: true } },
  transferTo: { select: { id: true } },
  debtPayment: { select: { id: true } },
  debtCharge: { select: { id: true } },
  debtDisbursement: { select: { id: true } },
  recurringPayment: { select: { id: true } },
  bankDifferenceOf: { select: { id: true } },
  _count: { select: { importedMatches: true } },
} satisfies Prisma.TransactionSelect;

type MergeRow = Prisma.TransactionGetPayload<{ select: typeof MERGE_SELECT }>;

/** Came from (or was confirmed by) the bank or a statement. */
const fromBank = (row: Pick<MergeRow, 'source' | '_count'>) =>
  row.source !== TransactionSource.manual || row._count.importedMatches > 0;

const transferOf = (row: MergeRow) =>
  row.transferFrom?.id ?? row.transferTo?.id ?? null;

/** Movements that never count as a duplicate of another. */
const NOT_MERGEABLE: Prisma.TransactionWhereInput = {
  type: { not: TransactionType.adjustment },
  bankDifferenceOf: { is: null },
  debtCharge: { is: null },
  debtDisbursement: { is: null },
};

/**
 * The same money recorded twice in one account (usually once by hand and
 * once by the bank): finding the pairs, suggesting them, and merging them
 * into one movement.
 */
@Injectable()
export class DuplicatesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Movements of the same account that may be this one recorded again: the
   * same amount going the same way, a few days apart, not dismissed as
   * different. Closest date first.
   */
  async candidates(userId: string, id: string): Promise<Transaction[]> {
    const row = await this.prisma.transaction.findFirst({
      where: { id, userId },
      select: MERGE_SELECT,
    });
    if (!row) throw new NotFoundError('Transaction not found');
    const rows = await this.findCandidates(this.prisma, row);
    return rows.map((candidate) => mapTransaction(candidate));
  }

  /**
   * Merges two records of the same money. The bank's stays (so syncing keeps
   * matching it); the other is deleted with its balance effect. The kept one
   * takes the other's name when asked, its category if it had none, its
   * notes, attachments, transfer side, loan payment, goal contributions and
   * recurring payment.
   */
  async merge(
    userId: string,
    input: {
      transactionId: string;
      duplicateId: string;
      keepId?: string | null;
      nameFrom: MergeNameFrom;
    },
  ): Promise<Transaction> {
    if (input.transactionId === input.duplicateId) {
      throw new ValidationError('Pick another movement');
    }
    const keepId = await this.prisma.$transaction((tx) =>
      this.mergeIn(tx, userId, input),
    );
    const kept = await this.prisma.transaction.findUniqueOrThrow({
      where: { id: keepId },
      include: TRANSACTION_PRESENTATION_INCLUDE,
    });
    return mapTransaction(kept);
  }

  /**
   * Looks for duplicates of these (new) movements and suggests the clear
   * ones: exactly one candidate, and one of the two from the bank.
   * Returns how many were suggested.
   */
  async detect(userId: string, transactionIds: string[]): Promise<number> {
    if (transactionIds.length === 0) return 0;
    const rows = await this.prisma.transaction.findMany({
      where: { id: { in: transactionIds }, userId, ...NOT_MERGEABLE },
      select: MERGE_SELECT,
    });
    let suggested = 0;
    for (const row of rows) {
      const candidates = await this.findCandidates(this.prisma, row);
      if (candidates.length !== 1) continue;
      const other = await this.prisma.transaction.findUniqueOrThrow({
        where: { id: candidates[0].id },
        select: MERGE_SELECT,
      });
      const pair = this.keepAndDrop(row, other);
      if (!pair) continue;
      const [keep, drop] = pair;
      const known = await this.prisma.duplicateSuggestion.findFirst({
        where: {
          OR: [
            { keepTxnId: keep.id, dropTxnId: drop.id },
            { keepTxnId: drop.id, dropTxnId: keep.id },
          ],
        },
        select: { id: true },
      });
      if (known) continue;
      await this.prisma.duplicateSuggestion.create({
        data: { userId, keepTxnId: keep.id, dropTxnId: drop.id },
      });
      suggested += 1;
    }
    return suggested;
  }

  /**
   * After a bank sync: a new bank movement that is exactly one side of a
   * transfer the user recorded by hand (same account, amount and direction,
   * a few days apart) is that side. They are merged at once (the bank's
   * stays, as the transfer side, with the user's name), so the transfer is
   * linked to the real movement and the money isn't counted twice.
   * Returns the ids merged into a transfer.
   */
  async mergeIntoTransfers(
    userId: string,
    transactionIds: string[],
  ): Promise<string[]> {
    if (transactionIds.length === 0) return [];
    const rows = await this.prisma.transaction.findMany({
      where: { id: { in: transactionIds }, userId, ...NOT_MERGEABLE },
      select: MERGE_SELECT,
    });
    const merged: string[] = [];
    for (const row of rows) {
      if (!fromBank(row) || transferOf(row)) continue;
      const candidates = await this.findCandidates(this.prisma, row);
      if (candidates.length !== 1) continue;
      const leg = candidates[0];
      if (fromBank(leg) || !(leg.transferFrom || leg.transferTo)) continue;
      await this.merge(userId, {
        transactionId: row.id,
        duplicateId: leg.id,
        keepId: row.id,
        nameFrom: MergeNameFrom.drop,
      });
      merged.push(row.id);
    }
    return merged;
  }

  async suggestions(
    userId: string,
    { first = 20, after }: { first?: number; after?: string | null },
  ): Promise<DuplicateSuggestionConnection> {
    const where = { userId, status: DuplicateSuggestionStatus.pending };
    const [rows, totalCount] = await Promise.all([
      this.prisma.duplicateSuggestion.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: first + 1,
        ...(after && { cursor: { id: after }, skip: 1 }),
        include: {
          keepTxn: {
            include: { ...TRANSACTION_PRESENTATION_INCLUDE, account: true },
          },
          dropTxn: {
            include: { ...TRANSACTION_PRESENTATION_INCLUDE, account: true },
          },
        },
      }),
      this.prisma.duplicateSuggestion.count({ where }),
    ]);
    const page = rows.slice(0, first);
    const edges = page.map((row) => ({
      cursor: row.id,
      node: {
        id: row.id,
        keep: mapTransaction(row.keepTxn),
        drop: mapTransaction(row.dropTxn),
        createdAt: row.createdAt,
      } satisfies DuplicateSuggestion,
    }));
    return {
      edges,
      totalCount,
      pageInfo: {
        hasNextPage: rows.length > first,
        hasPreviousPage: Boolean(after),
        startCursor: edges[0]?.cursor,
        endCursor: edges[edges.length - 1]?.cursor,
      },
    };
  }

  /** Merge a suggested pair, or remember it isn't one. */
  async resolve(
    userId: string,
    input: { id: string; action: DuplicateAction; nameFrom: MergeNameFrom },
  ): Promise<boolean> {
    const suggestion = await this.prisma.duplicateSuggestion.findFirst({
      where: { id: input.id, userId },
    });
    if (!suggestion) throw new NotFoundError('Suggestion not found');
    if (input.action === DuplicateAction.dismiss) {
      await this.prisma.duplicateSuggestion.update({
        where: { id: suggestion.id },
        data: {
          status: DuplicateSuggestionStatus.dismissed,
          resolvedAt: new Date(),
        },
      });
      return true;
    }
    // Merging deletes the dropped movement, and the suggestion with it.
    await this.merge(userId, {
      transactionId: suggestion.keepTxnId,
      duplicateId: suggestion.dropTxnId,
      keepId: suggestion.keepTxnId,
      nameFrom: input.nameFrom,
    });
    return true;
  }

  private async mergeIn(
    tx: Prisma.TransactionClient,
    userId: string,
    input: {
      transactionId: string;
      duplicateId: string;
      keepId?: string | null;
      nameFrom: MergeNameFrom;
    },
  ): Promise<string> {
    const rows = await tx.transaction.findMany({
      where: { id: { in: [input.transactionId, input.duplicateId] }, userId },
      select: MERGE_SELECT,
    });
    const a = rows.find((row) => row.id === input.transactionId);
    const b = rows.find((row) => row.id === input.duplicateId);
    if (!a || !b) throw new NotFoundError('Transaction not found');
    for (const row of [a, b]) {
      if (
        row.type === TransactionType.adjustment ||
        row.bankDifferenceOf ||
        row.debtCharge ||
        row.debtDisbursement
      ) {
        throw new ValidationError(
          'Balance adjustments and loan money cannot be merged',
        );
      }
    }
    if (!sameMoney(a, b)) {
      throw new ValidationError(
        'Only the same amount going the same way in one account, a few days apart, can be merged',
      );
    }
    if (fromBank(a) && fromBank(b)) {
      throw new ValidationError(
        'Both movements came from the bank; delete the one that is wrong instead',
      );
    }
    // The bank's stays; between two manual ones, the one asked for.
    const keepIsA = fromBank(a)
      ? true
      : fromBank(b)
        ? false
        : (input.keepId ?? a.id) === a.id;
    const keep = keepIsA ? a : b;
    const drop = keepIsA ? b : a;
    const nameFrom = input.nameFrom;

    const dropTransfer = transferOf(drop);
    if (dropTransfer && transferOf(keep)) {
      throw new ValidationError('Both movements are already in a transfer');
    }
    if (drop.debtPayment && keep.debtPayment) {
      throw new ValidationError('Both movements already pay a loan');
    }
    if (drop.recurringPayment && keep.recurringPayment) {
      throw new ValidationError('Both movements already pay a recurring bill');
    }

    // The links of the one that goes move to the one that stays.
    if (dropTransfer) {
      await tx.transfer.update({
        where: { id: dropTransfer },
        data: drop.transferFrom
          ? { fromTxnId: keep.id, convertedAt: new Date() }
          : { toTxnId: keep.id, convertedAt: new Date() },
      });
      await becomeSide(tx, keep);
    }
    if (drop.debtPayment) {
      await tx.debtPayment.update({
        where: { id: drop.debtPayment.id },
        data: { transactionId: keep.id },
      });
    }
    if (drop.recurringPayment) {
      await tx.recurringOccurrence.update({
        where: { id: drop.recurringPayment.id },
        data: { transactionId: keep.id },
      });
    }
    await tx.goalContribution.updateMany({
      where: { transactionId: drop.id },
      data: { transactionId: keep.id },
    });
    await tx.attachment.updateMany({
      where: { transactionId: drop.id },
      data: { transactionId: keep.id },
    });

    const dropName = presentTransaction(drop, true, true).displayName.trim();
    const notes = [keep.notes?.trim(), drop.notes?.trim()]
      .filter((note): note is string => Boolean(note))
      .filter((note, i, all) => all.indexOf(note) === i)
      .join('\n\n');
    const keepsType = !dropTransfer;
    await tx.transaction.update({
      where: { id: keep.id },
      data: {
        ...(nameFrom === MergeNameFrom.drop &&
          dropName && {
            aliasName: dropName,
            isPrivate: keep.isPrivate || drop.isPrivate,
          }),
        ...(keepsType &&
          !keep.categoryId &&
          drop.categoryId && {
            categoryId: drop.categoryId,
            categorySource: drop.categorySource,
          }),
        notes: notes || null,
      },
    });

    // Its money was counted twice: the dropped record's effect goes.
    await removeMovement(tx, drop);
    return keep.id;
  }

  private async findCandidates(
    client: Prisma.TransactionClient | PrismaService,
    row: MergeRow,
  ) {
    const amount = Number(row.amount);
    const rows = await client.transaction.findMany({
      where: {
        userId: row.userId,
        accountId: row.accountId,
        id: { not: row.id },
        ...NOT_MERGEABLE,
        amount: {
          gte: amount - AMOUNT_TOLERANCE,
          lte: amount + AMOUNT_TOLERANCE,
        },
        txnDate: {
          gte: addDays(row.txnDate, -DUPLICATE_DAYS_WINDOW),
          lte: addDays(row.txnDate, DUPLICATE_DAYS_WINDOW),
        },
        duplicateKeeps: {
          none: {
            dropTxnId: row.id,
            status: DuplicateSuggestionStatus.dismissed,
          },
        },
        duplicateDrops: {
          none: {
            keepTxnId: row.id,
            status: DuplicateSuggestionStatus.dismissed,
          },
        },
      },
      include: {
        ...TRANSACTION_PRESENTATION_INCLUDE,
        account: true,
        transferFrom: { select: { id: true } },
        transferTo: { select: { id: true } },
        _count: { select: { importedMatches: true } },
      },
      take: 20,
    });
    const day = row.txnDate.getTime();
    return rows
      .filter(
        (other) => Math.sign(effectOf(other)) === Math.sign(effectOf(row)),
      )
      .filter((other) => !(fromBank(other) && fromBank(row)))
      .filter(
        (other) =>
          !(
            (other.transferFrom || other.transferTo) &&
            (row.transferFrom || row.transferTo)
          ),
      )
      .sort(
        (a, b) =>
          Math.abs(a.txnDate.getTime() - day) -
            Math.abs(b.txnDate.getTime() - day) || a.id.localeCompare(b.id),
      );
  }

  /** The bank's stays; null when neither or both came from the bank. */
  private keepAndDrop(a: MergeRow, b: MergeRow): [MergeRow, MergeRow] | null {
    if (fromBank(a) === fromBank(b)) return null;
    return fromBank(a) ? [a, b] : [b, a];
  }
}

/** Same account, same amount going the same way, a few days apart. */
function sameMoney(a: MergeRow, b: MergeRow): boolean {
  if (a.accountId !== b.accountId) return false;
  if (Math.abs(Number(a.amount) - Number(b.amount)) > AMOUNT_TOLERANCE) {
    return false;
  }
  if (Math.sign(effectOf(a)) !== Math.sign(effectOf(b))) return false;
  const days = Math.abs(a.txnDate.getTime() - b.txnDate.getTime()) / 86_400_000;
  return days <= DUPLICATE_DAYS_WINDOW;
}
