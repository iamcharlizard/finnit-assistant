import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import {
  AccountType,
  ImportedLineStatus,
  OccurrenceMatchSource,
  OccurrenceStatus,
  Prisma,
  RecurringTrackingMode,
  StatementSource,
  StatementStatus,
  TransactionSource,
  type ImportedTransaction as ImportedTransactionRow,
  type StatementImport as StatementImportRow,
} from '@finnit/database';
import { PrismaService } from '../../services/prisma.service';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../common/exceptions/graphql-error.exception';
import { PaginationUtil } from '../../common/utils/pagination.util';
import {
  S3StorageService,
  type StoredObject,
} from '../storage/s3-storage.service';
import {
  CardMonthSummary,
  CardMonthSummaryArgs,
  StatementImport,
  StatementImportConnection,
  StatementImportsArgs,
  StatementLine,
  UpdateStatementLineInput,
} from './dto/statement.dto';
import { DEBIT_KINDS, StatementParseError } from './parsing/parsed-statement';
import { isPdf } from './parsing/pdf-text';
import { StatementParserRegistry } from './parsing/statement-parser.registry';
import { checkStatement } from './parsing/statement-validation';
import { ReconciliationService } from './reconciliation/reconciliation.service';
import { LineMaterializerService } from './reconciliation/line-materializer.service';

export const MAX_STATEMENT_BYTES = 10 * 1024 * 1024;

export interface UploadedStatementFile {
  buffer: Buffer;
  size: number;
}

/** Loads the recurring payment a line pays, for its name. */
const LINE_INCLUDE = {
  matchedOccurrence: {
    select: {
      id: true,
      dueDate: true,
      recurringExpense: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.ImportedTransactionInclude;

type LineRow = ImportedTransactionRow & {
  matchedOccurrence?: {
    id: string;
    dueDate: Date;
    recurringExpense: { id: string; name: string };
  } | null;
};

const toDate = (value?: string) =>
  value ? new Date(`${value}T00:00:00.000Z`) : null;

@Injectable()
export class StatementsService {
  private readonly logger = new Logger(StatementsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: S3StorageService,
    private readonly parsers: StatementParserRegistry,
    private readonly reconciliation: ReconciliationService,
    private readonly materializer: LineMaterializerService,
  ) {}

  /**
   * Stores the PDF and starts extraction in the background. Uploading the
   * same file again returns the existing import.
   */
  async upload(
    userId: string,
    accountId: string,
    file: UploadedStatementFile,
  ): Promise<StatementImport> {
    if (file.size > MAX_STATEMENT_BYTES) {
      throw new ValidationError('The file exceeds 10 MB');
    }
    if (!isPdf(file.buffer)) {
      throw new ValidationError('The file is not a PDF');
    }
    const account = await this.getCreditAccount(accountId, userId);

    const fileHash = createHash('sha256').update(file.buffer).digest('hex');
    const existing = await this.prisma.statementImport.findUnique({
      where: { userId_fileHash: { userId, fileHash } },
    });
    if (existing) return this.mapImport(existing);

    const created = await this.prisma.statementImport.create({
      data: {
        userId,
        accountId: account.id,
        source: StatementSource.pdf,
        currency: account.currency,
        fileHash,
      },
    });
    const fileKey = S3StorageService.key(
      userId,
      'statements',
      created.id,
      'pdf',
    );
    try {
      await this.storage.put(fileKey, file.buffer, 'application/pdf');
    } catch (error) {
      await this.prisma.statementImport.delete({ where: { id: created.id } });
      throw error;
    }
    const stored = await this.prisma.statementImport.update({
      where: { id: created.id },
      data: { fileKey },
    });

    this.processInBackground(stored.id);
    return this.mapImport(stored);
  }

  async reprocess(
    id: string,
    userId: string,
    parserId?: string,
  ): Promise<StatementImport> {
    const statement = await this.getOwned(id, userId);
    if (statement.status === StatementStatus.confirmed) {
      throw new ConflictError('A confirmed statement cannot be reprocessed');
    }
    if (statement.status === StatementStatus.processing) {
      throw new ConflictError('The statement is already being processed');
    }
    if (statement.source !== StatementSource.pdf || !statement.fileKey) {
      throw new ValidationError(
        'Only uploaded PDF statements can be reprocessed',
      );
    }
    if (parserId && !this.parsers.isKnownParser(parserId)) {
      throw new ValidationError(
        `Unknown parser. Use "ai", "ai:<AI model id>" or one of: ${this.parsers.localParserIds.join(', ')}`,
      );
    }
    this.processInBackground(id, parserId);
    return this.mapImport({ ...statement, status: StatementStatus.processing });
  }

  private processInBackground(id: string, parserId?: string) {
    // Runs in-process (single API replica). The client polls `statementImport`.
    void this.process(id, parserId).catch((error: Error) =>
      this.logger.error(`Statement ${id} processing crashed`, error),
    );
  }

  /** Extracts, validates and reconciles a stored PDF. Never throws. */
  async process(id: string, parserId?: string): Promise<void> {
    const statement = await this.prisma.statementImport.update({
      where: { id },
      data: { status: StatementStatus.processing, errorMessage: null },
      include: { account: true },
    });

    try {
      const pdf = await this.storage.get(statement.fileKey!);
      const { parser, statement: parsed } = await this.parsers.parse(
        pdf,
        parserId,
      );
      if (parsed.lines.length === 0) {
        throw new StatementParseError('No movements were found');
      }

      const last4 = (statement.account.metadata as { last4?: string } | null)
        ?.last4;
      if (last4 && parsed.cardLast4 && last4 !== parsed.cardLast4) {
        throw new StatementParseError(
          `This statement belongs to the card ending in ${parsed.cardLast4}, not ${last4}`,
        );
      }

      const check = checkStatement(parsed);
      const periodEnd = toDate(parsed.periodEnd ?? parsed.statementDate);

      await this.prisma.$transaction(async (tx) => {
        await tx.importedTransaction.deleteMany({
          where: { statementImportId: id },
        });
        await tx.statementImport.update({
          where: { id },
          data: {
            parser,
            currency: parsed.currency,
            periodStart: toDate(parsed.periodStart),
            periodEnd,
            statementDate: toDate(parsed.statementDate),
            paymentDueDate: toDate(parsed.paymentDueDate),
            previousBalance: parsed.previousBalance,
            totalCharges: parsed.totalCharges,
            totalCredits: parsed.totalCredits,
            statementBalance: parsed.statementBalance,
            noInterestPayment: parsed.noInterestPayment,
            minimumPayment: parsed.minimumPayment,
            computedTotal: check.computedTotal,
            difference: check.difference,
            rawExtraction: parsed as unknown as Prisma.InputJsonValue,
          },
        });
        await tx.importedTransaction.createMany({
          data: parsed.lines.map((line) => ({
            accountId: statement.accountId,
            statementImportId: id,
            kind: line.kind,
            amount: line.amount,
            currency: parsed.currency,
            date: toDate(line.date)!,
            postDate: toDate(line.postDate),
            description: line.description,
            merchant: line.merchant,
            installmentNumber: line.installmentNumber,
            installmentTotal: line.installmentTotal,
          })),
        });
      });

      await this.reconciliation.reconcileStatement(id);
      await this.prisma.statementImport.update({
        where: { id },
        data: { status: StatementStatus.needs_review },
      });
    } catch (error) {
      const message = this.describeFailure(error);
      this.logger.warn(`Statement ${id} failed: ${message}`);
      await this.prisma.statementImport.update({
        where: { id },
        data: { status: StatementStatus.failed, errorMessage: message },
      });
    }
  }

  private describeFailure(error: unknown): string {
    if (error instanceof StatementParseError) return error.message;
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return 'A statement for this period was already imported for this card';
    }
    return 'The statement could not be processed';
  }

  async findMany(
    userId: string,
    args: StatementImportsArgs,
  ): Promise<StatementImportConnection> {
    const where: Prisma.StatementImportWhereInput = {
      userId,
      ...(args.accountId && { accountId: args.accountId }),
    };
    const first = args.first ?? 20;
    const [rows, totalCount] = await Promise.all([
      this.prisma.statementImport.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: first,
        ...(args.after && {
          cursor: { id: PaginationUtil.decodeCursor(args.after) },
          skip: 1,
        }),
      }),
      this.prisma.statementImport.count({ where }),
    ]);
    return PaginationUtil.createConnection(
      rows.map((row) => this.mapImport(row)),
      { first, after: args.after },
      totalCount,
      (statement) => PaginationUtil.encodeCursor(statement.id),
    );
  }

  async findById(id: string, userId: string): Promise<StatementImport> {
    const statement = await this.prisma.statementImport.findFirst({
      where: { id, userId },
      include: {
        lines: {
          orderBy: [{ date: 'asc' }, { id: 'asc' }],
          include: LINE_INCLUDE,
        },
      },
    });
    if (!statement) throw new NotFoundError('Statement not found');
    return this.mapImport(statement, statement.lines);
  }

  /** The uploaded PDF, only for the statement's owner. */
  async openFile(id: string, userId: string): Promise<StoredObject> {
    const statement = await this.getOwned(id, userId);
    if (!statement.fileKey) {
      throw new NotFoundError('This statement has no file');
    }
    return this.storage.open(statement.fileKey);
  }

  async updateLine(
    lineId: string,
    userId: string,
    input: UpdateStatementLineInput,
  ): Promise<StatementLine> {
    const line = await this.prisma.importedTransaction.findFirst({
      where: { id: lineId, statementImport: { userId } },
      include: { statementImport: true },
    });
    if (!line?.statementImport) throw new NotFoundError('Line not found');
    if (line.statementImport.status !== StatementStatus.needs_review) {
      throw new ConflictError('Only statements in review can be edited');
    }

    const data: Prisma.ImportedTransactionUncheckedUpdateInput = {};

    if (input.status !== undefined) {
      if (
        input.status !== ImportedLineStatus.pending &&
        input.status !== ImportedLineStatus.ignored
      ) {
        throw new ValidationError(
          'A line can only be set to pending or ignored',
        );
      }
      data.status = input.status;
      if (input.status === ImportedLineStatus.pending) {
        data.matchedTransactionId = null;
      }
    }

    if (input.categoryId !== undefined) {
      if (input.categoryId) {
        const category = await this.prisma.category.findFirst({
          where: { id: input.categoryId, OR: [{ userId }, { userId: null }] },
          select: { id: true },
        });
        if (!category) throw new NotFoundError('Category not found');
      }
      data.suggestedCategoryId = input.categoryId || null;
    }

    if (input.matchedTransactionId !== undefined) {
      if (input.matchedTransactionId) {
        const transaction = await this.prisma.transaction.findFirst({
          where: {
            id: input.matchedTransactionId,
            userId,
            accountId: line.accountId,
          },
          include: { importedMatches: { select: { id: true } } },
        });
        if (!transaction) {
          throw new NotFoundError('Transaction not found on this card');
        }
        if (transaction.importedMatches.some((m) => m.id !== line.id)) {
          throw new ConflictError(
            'This transaction is already linked to another movement',
          );
        }
        data.matchedTransactionId = transaction.id;
        data.status = ImportedLineStatus.matched;
      } else {
        data.matchedTransactionId = null;
        data.status = ImportedLineStatus.pending;
      }
    }

    if (input.matchedOccurrenceId !== undefined) {
      if (input.matchedOccurrenceId) {
        const occurrence = await this.prisma.recurringOccurrence.findFirst({
          where: {
            id: input.matchedOccurrenceId,
            recurringExpense: {
              userId,
              trackingMode: { not: RecurringTrackingMode.reminder },
            },
          },
        });
        if (!occurrence) throw new NotFoundError('Recurring payment not found');
        if (occurrence.status === OccurrenceStatus.paid) {
          throw new ConflictError('This recurring payment is already paid');
        }
      }
      data.matchedOccurrenceId = input.matchedOccurrenceId || null;
    }

    const updated = await this.prisma.importedTransaction.update({
      where: { id: lineId },
      data,
      include: LINE_INCLUDE,
    });
    return this.mapLine(updated);
  }

  /**
   * Turns the review into data: pending lines become transactions (with the
   * card balance updated) and matched recurring payments are marked paid.
   */
  async confirm(id: string, userId: string): Promise<StatementImport> {
    const statement = await this.prisma.statementImport.findFirst({
      where: { id, userId },
      include: { lines: true },
    });
    if (!statement) throw new NotFoundError('Statement not found');
    if (statement.status !== StatementStatus.needs_review) {
      throw new ConflictError('Only statements in review can be confirmed');
    }

    await this.prisma.$transaction(
      async (tx) => {
        await this.materializer.materialize(tx, statement.lines, {
          userId,
          accountId: statement.accountId,
          source: TransactionSource.statement,
          matchedBy: OccurrenceMatchSource.statement,
          adjustBalance: true,
        });
        await tx.statementImport.update({
          where: { id },
          data: { status: StatementStatus.confirmed, confirmedAt: new Date() },
        });
      },
      { timeout: 30_000 },
    );

    return this.findById(id, userId);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const statement = await this.getOwned(id, userId);
    if (statement.status === StatementStatus.confirmed) {
      throw new ConflictError(
        'A confirmed statement cannot be deleted; its transactions already exist',
      );
    }
    if (statement.status === StatementStatus.processing) {
      throw new ConflictError('Wait until the statement finishes processing');
    }
    await this.prisma.statementImport.delete({ where: { id } });
    if (statement.fileKey) await this.storage.delete(statement.fileKey);
    return true;
  }

  /**
   * A card's month: the statement whose cut-off falls in it (if any) and the
   * recurring payments expected on the card in that statement period (or the
   * calendar month when there is no statement yet).
   */
  async cardMonthSummary(
    userId: string,
    args: CardMonthSummaryArgs,
  ): Promise<CardMonthSummary> {
    await this.getCreditAccount(args.accountId, userId);
    const monthStart = new Date(Date.UTC(args.year, args.month - 1, 1));
    const monthEnd = new Date(Date.UTC(args.year, args.month, 0));

    const statement = await this.prisma.statementImport.findFirst({
      where: {
        userId,
        accountId: args.accountId,
        status: { not: StatementStatus.failed },
        periodEnd: { gte: monthStart, lte: monthEnd },
      },
      orderBy: { periodEnd: 'desc' },
      include: { lines: true },
    });

    const periodStart = statement?.periodStart ?? monthStart;
    const periodEnd = statement?.periodEnd ?? monthEnd;

    const occurrences = await this.prisma.recurringOccurrence.findMany({
      where: {
        dueDate: { gte: periodStart, lte: periodEnd },
        recurringExpense: { userId, accountId: args.accountId },
      },
      include: { recurringExpense: { select: { id: true, name: true } } },
      orderBy: { dueDate: 'asc' },
    });

    const recurringPayments = occurrences.map((o) => ({
      recurringExpenseId: o.recurringExpense.id,
      name: o.recurringExpense.name,
      occurrenceId: o.id,
      dueDate: o.dueDate,
      expectedAmount: Number(o.expectedAmount),
      status: o.status,
    }));
    const sum = (values: number[]) =>
      Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100;

    // Charges that were not registered before the statement arrived.
    const newCharges = (statement?.lines ?? []).filter(
      (line) =>
        DEBIT_KINDS.has(line.kind) &&
        !line.matchedOccurrenceId &&
        (line.status === ImportedLineStatus.pending ||
          line.status === ImportedLineStatus.created),
    );

    return {
      accountId: args.accountId,
      year: args.year,
      month: args.month,
      statement: statement ? this.mapImport(statement) : undefined,
      periodStart,
      periodEnd,
      recurringPayments,
      recurringExpected: sum(recurringPayments.map((p) => p.expectedAmount)),
      recurringPaid: sum(
        recurringPayments
          .filter((p) => p.status === OccurrenceStatus.paid)
          .map((p) => p.expectedAmount),
      ),
      newChargesCount: newCharges.length,
      newChargesAmount: sum(newCharges.map((line) => Number(line.amount))),
    };
  }

  private async getOwned(id: string, userId: string) {
    const statement = await this.prisma.statementImport.findFirst({
      where: { id, userId },
    });
    if (!statement) throw new NotFoundError('Statement not found');
    return statement;
  }

  private async getCreditAccount(accountId: string, userId: string) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId },
    });
    if (!account) throw new NotFoundError('Account not found');
    if (account.type !== AccountType.credit) {
      throw new ValidationError(
        'Statements can only be imported for credit cards',
      );
    }
    return account;
  }

  private mapImport(
    row: StatementImportRow,
    lines?: LineRow[],
  ): StatementImport {
    const money = (value: Prisma.Decimal | null) =>
      value === null ? undefined : Number(value);
    return {
      id: row.id,
      accountId: row.accountId,
      source: row.source,
      status: row.status,
      parser: row.parser ?? undefined,
      periodStart: row.periodStart ?? undefined,
      periodEnd: row.periodEnd ?? undefined,
      statementDate: row.statementDate ?? undefined,
      paymentDueDate: row.paymentDueDate ?? undefined,
      previousBalance: money(row.previousBalance),
      totalCharges: money(row.totalCharges),
      totalCredits: money(row.totalCredits),
      statementBalance: money(row.statementBalance),
      noInterestPayment: money(row.noInterestPayment),
      minimumPayment: money(row.minimumPayment),
      currency: row.currency,
      computedTotal: money(row.computedTotal),
      difference: money(row.difference),
      errorMessage: row.errorMessage ?? undefined,
      confirmedAt: row.confirmedAt ?? undefined,
      createdAt: row.createdAt,
      lines: lines?.map((line) => this.mapLine(line)),
    };
  }

  private mapLine(row: LineRow): StatementLine {
    const occurrence = row.matchedOccurrence;
    return {
      id: row.id,
      date: row.date,
      postDate: row.postDate ?? undefined,
      description: row.description ?? undefined,
      merchant: row.merchant ?? undefined,
      amount: Number(row.amount),
      currency: row.currency,
      kind: row.kind,
      status: row.status,
      installmentNumber: row.installmentNumber ?? undefined,
      installmentTotal: row.installmentTotal ?? undefined,
      suggestedCategoryId: row.suggestedCategoryId ?? undefined,
      matchedTransactionId: row.matchedTransactionId ?? undefined,
      matchedOccurrenceId: row.matchedOccurrenceId ?? undefined,
      matchedRecurringPayment: occurrence
        ? {
            occurrenceId: occurrence.id,
            recurringExpenseId: occurrence.recurringExpense.id,
            name: occurrence.recurringExpense.name,
            dueDate: occurrence.dueDate,
          }
        : undefined,
    };
  }
}
