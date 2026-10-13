import { Injectable } from '@nestjs/common';
import {
  CategorySource,
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
import { MerchantAliasesService } from '../../categorization/merchant-aliases.service';
import { MerchantRulesService } from '../../categorization/merchant-rules.service';

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
  constructor(
    private readonly recurringExpenses: RecurringExpensesService,
    private readonly rules: MerchantRulesService,
    private readonly aliases: MerchantAliasesService,
  ) {}

  async materialize(
    tx: Prisma.TransactionClient,
    lines: ImportedTransactionRow[],
    options: MaterializeOptions,
  ): Promise<{ created: number; balanceChange: number }> {
    let created = 0;
    let balanceChange = 0;
    const createdIds: string[] = [];
    const pendingLines = lines.filter(
      (line) => line.status === ImportedLineStatus.pending,
    );
    const ruleMatches = await this.rules.match(
      options.userId,
      pendingLines.map((line) => line.merchant ?? line.description),
      tx,
    );

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
        const categoryId =
          type === TransactionType.adjustment ? null : line.suggestedCategoryId;
        const transaction = await tx.transaction.create({
          data: {
            userId: options.userId,
            accountId: options.accountId,
            categoryId,
            categorySource: categoryId
              ? this.categorySource(
                  categoryId,
                  ruleMatches.get(line.merchant ?? line.description ?? '')
                    ?.categoryId,
                  options.source,
                )
              : null,
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
        createdIds.push(transaction.id);
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

    await this.aliases.applyTo(options.userId, createdIds, tx);

    if (options.adjustBalance && balanceChange !== 0) {
      await tx.account.update({
        where: { id: options.accountId },
        data: { balanceCurrent: { increment: balanceChange } },
      });
    }
    return { created, balanceChange };
  }

  /**
   * Where an imported line's category came from: the user's merchant rule
   * when it agrees; otherwise the bank sync (no review) or the statement
   * review the user confirmed.
   */
  private categorySource(
    categoryId: string,
    ruleCategoryId: string | undefined,
    source: TransactionSource,
  ): CategorySource {
    if (ruleCategoryId === categoryId) return CategorySource.rule;
    return source === TransactionSource.imported
      ? CategorySource.bank
      : CategorySource.manual;
  }
}
