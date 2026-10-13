import { Injectable } from '@nestjs/common';
import {
  ImportedLineKind,
  ImportedLineStatus,
  OccurrenceMatchSource,
  Prisma,
  TransactionSource,
  TransactionType,
  type ImportedTransaction as ImportedTransactionRow,
} from '@finnit/database';
import { RecurringExpensesService } from '../../recurring-expenses/recurring-expenses.service';
import { DEBIT_KINDS } from '../parsing/parsed-statement';

export interface MaterializeOptions {
  userId: string;
  accountId: string;
  source: TransactionSource;
  matchedBy: OccurrenceMatchSource;
  /** Add the created movements to the account balance (false when the bank reports the balance). */
  adjustBalance: boolean;
  /** Stable id per line, so a line can never create two transactions. */
  externalId?: (line: ImportedTransactionRow) => string | undefined;
}

/**
 * Turns reviewed import lines into data: pending lines become transactions
 * and the recurring payments they settle are marked paid. Runs inside the
 * caller's database transaction.
 */
@Injectable()
export class LineMaterializerService {
  constructor(private readonly recurringExpenses: RecurringExpensesService) {}

  async materialize(
    tx: Prisma.TransactionClient,
    lines: ImportedTransactionRow[],
    options: MaterializeOptions,
  ): Promise<{ created: number; balanceChange: number }> {
    let created = 0;
    let balanceChange = 0;

    for (const line of lines) {
      let transactionId = line.matchedTransactionId;

      if (line.status === ImportedLineStatus.pending) {
        const isDebit = DEBIT_KINDS.has(line.kind);
        const amount = Number(line.amount);
        // Deposits are income; card payments and refunds are not, so they are
        // balance adjustments that reports leave out.
        const type = isDebit
          ? TransactionType.expense
          : line.kind === ImportedLineKind.deposit
            ? TransactionType.income
            : TransactionType.adjustment;
        const transaction = await tx.transaction.create({
          data: {
            userId: options.userId,
            accountId: options.accountId,
            categoryId:
              type === TransactionType.adjustment
                ? null
                : line.suggestedCategoryId,
            type,
            amount,
            currency: line.currency,
            txnDate: line.date,
            description: line.description,
            merchantName: line.merchant ?? line.description,
            source: options.source,
            externalId: options.externalId?.(line),
          },
        });
        transactionId = transaction.id;
        created += 1;
        balanceChange += isDebit ? -amount : amount;
        await tx.importedTransaction.update({
          where: { id: line.id },
          data: {
            status: ImportedLineStatus.created,
            matchedTransactionId: transaction.id,
          },
        });
      }

      if (
        line.matchedOccurrenceId &&
        line.status !== ImportedLineStatus.ignored
      ) {
        const alreadyLinked = transactionId
          ? await tx.recurringOccurrence.findUnique({
              where: { transactionId },
              select: { id: true },
            })
          : null;
        await this.recurringExpenses.markPaidInTransaction(
          tx,
          line.matchedOccurrenceId,
          alreadyLinked ? null : transactionId,
          options.matchedBy,
        );
      }
    }

    if (options.adjustBalance && balanceChange !== 0) {
      await tx.account.update({
        where: { id: options.accountId },
        data: { balanceCurrent: { increment: balanceChange } },
      });
    }
    return { created, balanceChange };
  }
}
