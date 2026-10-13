import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import {
  AccountType,
  ImportedLineKind,
  ImportedLineStatus,
  OccurrenceMatchSource,
  Prisma,
  StatementSource,
  StatementStatus,
  TransactionSource,
  TransactionType,
} from '@finnit/database';
import { PrismaService } from '../../services/prisma.service';
import { S3StorageService } from '../storage/s3-storage.service';
import { RecurringExpensesService } from '../recurring-expenses/recurring-expenses.service';
import { StatementParserRegistry } from './parsing/statement-parser.registry';
import { ReconciliationService } from './reconciliation/reconciliation.service';
import { LineMaterializerService } from './reconciliation/line-materializer.service';
import { StatementsService } from './statements.service';
import {
  ConflictError,
  ValidationError,
} from '../../common/exceptions/graphql-error.exception';
import { StatementParseError } from './parsing/parsed-statement';
import { MerchantRulesService } from '../categorization/merchant-rules.service';
import { MerchantAliasesService } from '../categorization/merchant-aliases.service';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('StatementsService', () => {
  let service: StatementsService;
  let prisma: DeepMockProxy<PrismaService>;
  let storage: DeepMockProxy<S3StorageService>;
  let parsers: DeepMockProxy<StatementParserRegistry>;
  let reconciliation: DeepMockProxy<ReconciliationService>;
  let recurring: DeepMockProxy<RecurringExpensesService>;
  let rules: DeepMockProxy<MerchantRulesService>;
  let aliases: DeepMockProxy<MerchantAliasesService>;

  const userId = 'user-1';
  const pdf = Buffer.from('%PDF-1.7 statement');

  const card = {
    id: 'card-1',
    userId,
    type: AccountType.credit,
    currency: 'MXN',
    metadata: { last4: '1234' },
  };

  const statementRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'st-1',
    userId,
    accountId: 'card-1',
    source: StatementSource.pdf,
    status: StatementStatus.needs_review,
    parser: 'claude',
    periodStart: d('2026-08-16'),
    periodEnd: d('2026-09-15'),
    statementDate: d('2026-09-15'),
    paymentDueDate: d('2026-10-05'),
    previousBalance: new Prisma.Decimal(1000),
    totalCharges: null,
    totalCredits: null,
    statementBalance: new Prisma.Decimal(1349),
    noInterestPayment: new Prisma.Decimal(1349),
    minimumPayment: new Prisma.Decimal(200),
    currency: 'MXN',
    fileKey: 'users/user-1/statements/st-1.pdf',
    fileHash: 'hash',
    computedTotal: new Prisma.Decimal(1349),
    difference: new Prisma.Decimal(0),
    errorMessage: null,
    rawExtraction: null,
    confirmedAt: null,
    createdAt: d('2026-09-16'),
    updatedAt: d('2026-09-16'),
    ...overrides,
  });

  const lineRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'line-1',
    accountId: 'card-1',
    linkedAccountId: null,
    statementImportId: 'st-1',
    providerTxnId: null,
    kind: ImportedLineKind.charge,
    status: ImportedLineStatus.pending,
    amount: new Prisma.Decimal(299),
    currency: 'MXN',
    date: d('2026-09-10'),
    postDate: null,
    description: 'NETFLIX.COM',
    merchant: null,
    installmentNumber: null,
    installmentTotal: null,
    suggestedCategoryId: 'cat-streaming',
    raw: null,
    matchedTransactionId: null,
    matchedOccurrenceId: null,
    importedAt: d('2026-09-16'),
    ...overrides,
  });

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    storage = mockDeep<S3StorageService>();
    parsers = mockDeep<StatementParserRegistry>();
    reconciliation = mockDeep<ReconciliationService>();
    recurring = mockDeep<RecurringExpensesService>();
    rules = mockDeep<MerchantRulesService>();
    rules.match.mockResolvedValue(new Map());
    aliases = mockDeep<MerchantAliasesService>();
    prisma.$transaction.mockImplementation(
      (fn: unknown) => (fn as (tx: unknown) => unknown)(prisma) as never,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatementsService,
        { provide: PrismaService, useValue: prisma },
        { provide: S3StorageService, useValue: storage },
        { provide: StatementParserRegistry, useValue: parsers },
        { provide: ReconciliationService, useValue: reconciliation },
        { provide: RecurringExpensesService, useValue: recurring },
        { provide: MerchantRulesService, useValue: rules },
        { provide: MerchantAliasesService, useValue: aliases },
        LineMaterializerService,
      ],
    }).compile();
    service = module.get(StatementsService);
  });

  describe('upload', () => {
    it('rejects files that are not PDFs', async () => {
      await expect(
        service.upload(userId, 'card-1', {
          buffer: Buffer.from('hello'),
          size: 5,
        }),
      ).rejects.toThrow(new ValidationError('The file is not a PDF'));
    });

    it('rejects accounts that are not credit cards', async () => {
      prisma.account.findFirst.mockResolvedValue({
        ...card,
        type: AccountType.debit,
      } as never);
      await expect(
        service.upload(userId, 'card-1', { buffer: pdf, size: pdf.length }),
      ).rejects.toThrow(ValidationError);
    });

    it('returns the existing import for a file uploaded before', async () => {
      prisma.account.findFirst.mockResolvedValue(card as never);
      prisma.statementImport.findUnique.mockResolvedValue(statementRow());

      const result = await service.upload(userId, 'card-1', {
        buffer: pdf,
        size: pdf.length,
      });

      expect(result.id).toBe('st-1');
      expect(storage.put).not.toHaveBeenCalled();
      expect(prisma.statementImport.create).not.toHaveBeenCalled();
    });

    it('stores the file under the user prefix and starts processing', async () => {
      prisma.account.findFirst.mockResolvedValue(card as never);
      prisma.statementImport.findUnique.mockResolvedValue(null);
      prisma.statementImport.create.mockResolvedValue(
        statementRow({
          status: StatementStatus.uploaded,
          fileKey: null,
        }),
      );
      prisma.statementImport.update.mockResolvedValue(
        statementRow({ status: StatementStatus.uploaded }),
      );
      const process = jest.spyOn(service, 'process').mockResolvedValue();

      const result = await service.upload(userId, 'card-1', {
        buffer: pdf,
        size: pdf.length,
      });

      expect(storage.put).toHaveBeenCalledWith(
        'users/user-1/statements/st-1.pdf',
        pdf,
        'application/pdf',
      );
      expect(process).toHaveBeenCalledWith('st-1', undefined);
      expect(result.status).toBe(StatementStatus.uploaded);
    });

    it('removes the row when the upload to storage fails', async () => {
      prisma.account.findFirst.mockResolvedValue(card as never);
      prisma.statementImport.findUnique.mockResolvedValue(null);
      prisma.statementImport.create.mockResolvedValue(statementRow());
      storage.put.mockRejectedValue(new Error('S3 down'));

      await expect(
        service.upload(userId, 'card-1', { buffer: pdf, size: pdf.length }),
      ).rejects.toThrow('S3 down');
      expect(prisma.statementImport.delete).toHaveBeenCalledWith({
        where: { id: 'st-1' },
      });
    });
  });

  describe('process', () => {
    beforeEach(() => {
      prisma.statementImport.update.mockResolvedValue({
        ...statementRow({ status: StatementStatus.processing }),
        account: card,
      } as never);
      storage.get.mockResolvedValue(pdf);
    });

    it('stores totals and lines, reconciles and leaves it in review', async () => {
      parsers.parse.mockResolvedValue({
        parser: 'claude',
        statement: {
          currency: 'MXN',
          cardLast4: '1234',
          periodEnd: '2026-09-15',
          previousBalance: 1000,
          statementBalance: 1299,
          lines: [
            {
              date: '2026-09-10',
              description: 'NETFLIX',
              amount: 299,
              kind: ImportedLineKind.charge,
            },
          ],
        },
      });

      await service.process('st-1');

      expect(prisma.importedTransaction.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            statementImportId: 'st-1',
            accountId: 'card-1',
            amount: 299,
            date: d('2026-09-10'),
          }),
        ],
      });
      expect(prisma.statementImport.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ computedTotal: 1299, difference: 0 }),
        }),
      );
      expect(reconciliation.reconcileStatement).toHaveBeenCalledWith('st-1');
      expect(prisma.statementImport.update).toHaveBeenLastCalledWith({
        where: { id: 'st-1' },
        data: { status: StatementStatus.needs_review },
      });
    });

    it('fails when the statement belongs to another card', async () => {
      parsers.parse.mockResolvedValue({
        parser: 'claude',
        statement: {
          currency: 'MXN',
          cardLast4: '9999',
          lines: [
            {
              date: '2026-09-10',
              description: 'X',
              amount: 1,
              kind: ImportedLineKind.charge,
            },
          ],
        },
      });

      await service.process('st-1');

      expect(prisma.statementImport.update).toHaveBeenLastCalledWith({
        where: { id: 'st-1' },
        data: {
          status: StatementStatus.failed,
          errorMessage:
            'This statement belongs to the card ending in 9999, not 1234',
        },
      });
    });

    it('records parser errors without throwing', async () => {
      parsers.parse.mockRejectedValue(
        new StatementParseError('Unsupported statement format'),
      );

      await expect(service.process('st-1')).resolves.toBeUndefined();
      expect(prisma.statementImport.update).toHaveBeenLastCalledWith({
        where: { id: 'st-1' },
        data: {
          status: StatementStatus.failed,
          errorMessage: 'Unsupported statement format',
        },
      });
    });

    it('hides unexpected error details from the user', async () => {
      parsers.parse.mockRejectedValue(new Error('socket hang up'));
      await service.process('st-1');
      expect(prisma.statementImport.update).toHaveBeenLastCalledWith({
        where: { id: 'st-1' },
        data: {
          status: StatementStatus.failed,
          errorMessage: 'The statement could not be processed',
        },
      });
    });
  });

  describe('confirm', () => {
    it('creates pending lines, marks recurring payments and updates the balance', async () => {
      prisma.statementImport.findFirst
        .mockResolvedValueOnce({
          ...statementRow(),
          lines: [
            lineRow({ matchedOccurrenceId: 'occ-1' }),
            lineRow({
              id: 'line-2',
              kind: ImportedLineKind.payment,
              amount: new Prisma.Decimal(500),
              description: 'PAGO GRACIAS',
            }),
            lineRow({
              id: 'line-3',
              status: ImportedLineStatus.matched,
              matchedTransactionId: 'txn-existing',
              amount: new Prisma.Decimal(150),
            }),
            lineRow({ id: 'line-4', status: ImportedLineStatus.ignored }),
          ],
        } as never)
        .mockResolvedValueOnce({ ...statementRow(), lines: [] } as never);
      prisma.transaction.create
        .mockResolvedValueOnce({ id: 'txn-new-1' } as never)
        .mockResolvedValueOnce({ id: 'txn-new-2' } as never);
      prisma.recurringOccurrence.findUnique.mockResolvedValue(null);

      await service.confirm('st-1', userId);

      expect(prisma.transaction.create).toHaveBeenCalledTimes(2);
      expect(prisma.transaction.create).toHaveBeenNthCalledWith(1, {
        data: expect.objectContaining({
          type: TransactionType.expense,
          amount: 299,
          categoryId: 'cat-streaming',
          source: TransactionSource.statement,
          merchantName: 'NETFLIX.COM',
        }),
      });
      // Payments are adjustments, never income.
      expect(prisma.transaction.create).toHaveBeenNthCalledWith(2, {
        data: expect.objectContaining({
          type: TransactionType.adjustment,
          amount: 500,
          categoryId: null,
        }),
      });
      expect(recurring.markPaidInTransaction).toHaveBeenCalledWith(
        prisma,
        'occ-1',
        'txn-new-1',
        OccurrenceMatchSource.statement,
      );
      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: 'card-1' },
        data: { balanceCurrent: { increment: 201 } },
      });
      expect(prisma.statementImport.update).toHaveBeenCalledWith({
        where: { id: 'st-1' },
        data: {
          status: StatementStatus.confirmed,
          confirmedAt: expect.any(Date),
        },
      });
    });

    it('only confirms statements in review', async () => {
      prisma.statementImport.findFirst.mockResolvedValue({
        ...statementRow({ status: StatementStatus.confirmed }),
        lines: [],
      } as never);
      await expect(service.confirm('st-1', userId)).rejects.toThrow(
        ConflictError,
      );
    });
  });

  describe('delete', () => {
    it('refuses confirmed statements', async () => {
      prisma.statementImport.findFirst.mockResolvedValue(
        statementRow({ status: StatementStatus.confirmed }),
      );
      await expect(service.delete('st-1', userId)).rejects.toThrow(
        ConflictError,
      );
    });

    it('deletes the row and the file', async () => {
      prisma.statementImport.findFirst.mockResolvedValue(statementRow());
      await service.delete('st-1', userId);
      expect(prisma.statementImport.delete).toHaveBeenCalledWith({
        where: { id: 'st-1' },
      });
      expect(storage.delete).toHaveBeenCalledWith(
        'users/user-1/statements/st-1.pdf',
      );
    });
  });

  describe('lines with recurring payments', () => {
    const dueDate = new Date('2026-10-05T00:00:00Z');
    const occurrence = {
      id: 'occ-1',
      dueDate,
      recurringExpense: { id: 'rec-1', name: 'Netflix' },
    };

    it('findById names the recurring payment each line pays', async () => {
      prisma.statementImport.findFirst.mockResolvedValue({
        ...statementRow({ status: StatementStatus.needs_review }),
        lines: [
          lineRow({
            matchedOccurrenceId: 'occ-1',
            matchedOccurrence: occurrence,
          }),
          lineRow({ id: 'line-2', matchedOccurrence: null }),
        ],
      } as never);

      const result = await service.findById('st-1', userId);

      expect(prisma.statementImport.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            lines: expect.objectContaining({
              include: { matchedOccurrence: expect.any(Object) },
            }),
          },
        }),
      );
      expect(result.lines?.[0]?.matchedRecurringPayment).toEqual({
        occurrenceId: 'occ-1',
        recurringExpenseId: 'rec-1',
        name: 'Netflix',
        dueDate,
      });
      expect(result.lines?.[1]?.matchedRecurringPayment).toBeUndefined();
    });

    it('updateLine returns the line with its recurring payment', async () => {
      prisma.importedTransaction.findFirst.mockResolvedValue({
        ...lineRow(),
        statementImport: statementRow({ status: StatementStatus.needs_review }),
      } as never);
      prisma.importedTransaction.update.mockResolvedValue({
        ...lineRow({ status: ImportedLineStatus.ignored }),
        matchedOccurrence: occurrence,
      } as never);

      const line = await service.updateLine('line-1', userId, {
        status: ImportedLineStatus.ignored,
      });

      expect(prisma.importedTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { matchedOccurrence: expect.any(Object) },
        }),
      );
      expect(line.status).toBe(ImportedLineStatus.ignored);
      expect(line.matchedRecurringPayment?.name).toBe('Netflix');
    });
  });
});
