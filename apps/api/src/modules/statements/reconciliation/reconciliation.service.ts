import { Injectable } from '@nestjs/common';
import {
  ImportedLineStatus,
  OccurrenceStatus,
  RecurringTrackingMode,
  type ImportedTransaction as ImportedTransactionRow,
} from '@finnit/database';
import { PrismaService } from '../../../services/prisma.service';
import { CategoriesService } from '../../categories/categories.service';
import { MerchantRulesService } from '../../categorization/merchant-rules.service';
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
    private readonly rules: MerchantRulesService,
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
        },
      },
    });
    await this.reconcileLines(
      statement.userId,
      statement.accountId,
      statement.lines,
      'statement',
    );
  }

  /**
   * Reconciles lines that belong to one account (a statement, or a batch of
   * bank movements). A transaction can be claimed once by a statement line
   * and once by a bank line, so the monthly statement still recognizes the
   * purchases that the bank sync already imported.
   */
  async reconcileLines(
    userId: string,
    accountId: string,
    rows: ImportedTransactionRow[],
    scope: 'statement' | 'bank',
  ): Promise<void> {
    if (rows.length === 0) return;
    const sorted = [...rows].sort(
      (a, b) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id),
    );
    const lineIds = sorted.map((line) => line.id);
    const lines: LineToMatch[] = sorted.map((line) => ({
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
          importedMatches: {
            none: {
              id: { notIn: lineIds },
              ...(scope === 'statement'
                ? { statementImportId: { not: null } }
                : { linkedAccountId: { not: null } }),
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

    // Merchant rules the user taught come before the frequency guess.
    const ruleMatches = await this.rules.match(
      userId,
      sorted.map((line) => line.merchant ?? line.description),
    );
    const suggestions = new Map<string, string | null>();
    for (const line of sorted) {
      const occurrenceId = occurrenceMatches.get(line.id) ?? null;
      const transactionId = transactionMatches.get(line.id) ?? null;

      let categoryId =
        (occurrenceId && expenseCategory.get(occurrenceId)) ||
        line.suggestedCategoryId;
      const merchant = line.merchant ?? line.description;
      if (!categoryId && merchant) {
        categoryId = ruleMatches.get(merchant)?.categoryId ?? null;
      }
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
