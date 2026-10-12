import { Injectable } from '@nestjs/common';
import {
  ImportedLineStatus,
  OccurrenceStatus,
  RecurringTrackingMode,
} from '@finnit/database';
import { PrismaService } from '../../../services/prisma.service';
import { CategoriesService } from '../../categories/categories.service';
import { addDays } from '../../recurring-expenses/schedule.util';
import { matchOccurrences, matchTransactions, LineToMatch } from './matching';

const WINDOW_DAYS = 10;

/**
 * Reconciles the lines of one import (statement PDF or bank sync) against the
 * account: existing transactions, recurring payments and a suggested category.
 * Idempotent; lines the user set to `ignored`, and lines already `created`,
 * are left alone.
 */
@Injectable()
export class ReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: CategoriesService,
  ) {}

  async reconcileStatement(statementImportId: string): Promise<void> {
    const statement = await this.prisma.statementImport.findUniqueOrThrow({
      where: { id: statementImportId },
      include: {
        lines: {
          where: {
            status: {
              in: [ImportedLineStatus.pending, ImportedLineStatus.matched],
            },
          },
          orderBy: [{ date: 'asc' }, { id: 'asc' }],
        },
      },
    });
    if (statement.lines.length === 0) return;

    const { userId, accountId } = statement;
    const lines: LineToMatch[] = statement.lines.map((line) => ({
      id: line.id,
      date: line.date,
      amount: Number(line.amount),
      kind: line.kind,
      description: line.description,
      merchant: line.merchant,
    }));
    const from = addDays(lines[0].date, -WINDOW_DAYS);
    const to = addDays(lines[lines.length - 1].date, WINDOW_DAYS);

    const [transactions, occurrences] = await Promise.all([
      this.prisma.transaction.findMany({
        where: {
          userId,
          accountId,
          txnDate: { gte: from, lte: to },
          // Not already claimed by a line of another import.
          importedMatches: {
            none: {
              OR: [
                { statementImportId: null },
                { statementImportId: { not: statementImportId } },
              ],
            },
          },
        },
      }),
      this.prisma.recurringOccurrence.findMany({
        where: {
          dueDate: { gte: from, lte: to },
          status: { in: [OccurrenceStatus.upcoming, OccurrenceStatus.missed] },
          recurringExpense: {
            userId,
            trackingMode: { not: RecurringTrackingMode.reminder },
            OR: [{ accountId }, { accountId: null }],
          },
        },
        include: { recurringExpense: true },
      }),
    ]);

    const transactionMatches = matchTransactions(
      lines,
      transactions.map((t) => ({
        id: t.id,
        type: t.type,
        amount: Number(t.amount),
        txnDate: t.txnDate,
        merchantName: t.merchantName,
        description: t.description,
      })),
    );
    const occurrenceMatches = matchOccurrences(
      lines,
      occurrences.map((o) => ({
        id: o.id,
        dueDate: o.dueDate,
        expectedAmount: Number(o.expectedAmount),
        expenseName: o.recurringExpense.name,
        merchantPattern: o.recurringExpense.merchantPattern,
        isVariableAmount: o.recurringExpense.isVariableAmount,
      })),
    );
    const expenseCategory = new Map(
      occurrences.map((o) => [o.id, o.recurringExpense.categoryId]),
    );

    const suggestions = new Map<string, string | null>();
    for (const line of statement.lines) {
      const occurrenceId = occurrenceMatches.get(line.id) ?? null;
      const transactionId = transactionMatches.get(line.id) ?? null;

      let categoryId =
        (occurrenceId && expenseCategory.get(occurrenceId)) ||
        line.suggestedCategoryId;
      const merchant = line.merchant ?? line.description;
      if (!categoryId && merchant) {
        if (!suggestions.has(merchant)) {
          const category = await this.categories.suggestCategoryForMerchant(
            userId,
            merchant,
          );
          suggestions.set(merchant, category?.id ?? null);
        }
        categoryId = suggestions.get(merchant) ?? null;
      }

      await this.prisma.importedTransaction.update({
        where: { id: line.id },
        data: {
          matchedTransactionId: transactionId,
          matchedOccurrenceId: occurrenceId,
          suggestedCategoryId: categoryId,
          status: transactionId
            ? ImportedLineStatus.matched
            : ImportedLineStatus.pending,
        },
      });
    }
  }
}
