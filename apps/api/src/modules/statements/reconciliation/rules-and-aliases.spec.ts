import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import {
  CategorySource,
  ImportedLineKind,
  ImportedLineStatus,
  OccurrenceMatchSource,
  Prisma,
  TransactionSource,
  type ImportedTransaction,
} from '@finnit/database';
import { PrismaService } from '../../../services/prisma.service';
import { CategoriesService } from '../../categories/categories.service';
import { MerchantAliasesService } from '../../categorization/merchant-aliases.service';
import { MerchantRulesService } from '../../categorization/merchant-rules.service';
import { RecurringExpensesService } from '../../recurring-expenses/recurring-expenses.service';
import { LineMaterializerService } from './line-materializer.service';
import { ReconciliationService } from './reconciliation.service';

const userId = 'user-1';

const line = (
  id: string,
  overrides: Partial<ImportedTransaction> = {},
): ImportedTransaction => ({
  id,
  accountId: 'card-1',
  linkedAccountId: null,
  statementImportId: 'st-1',
  providerTxnId: null,
  kind: ImportedLineKind.charge,
  status: ImportedLineStatus.pending,
  amount: new Prisma.Decimal(100),
  currency: 'MXN',
  date: new Date('2026-10-05'),
  postDate: null,
  description: null,
  merchant: 'OXXO GAS 0042',
  installmentNumber: null,
  installmentTotal: null,
  suggestedCategoryId: null,
  raw: null,
  matchedTransactionId: null,
  matchedOccurrenceId: null,
  importedAt: new Date(),
  ...overrides,
});

describe('imports use merchant rules and aliases', () => {
  let rules: DeepMockProxy<MerchantRulesService>;

  beforeEach(() => {
    rules = mockDeep<MerchantRulesService>();
    rules.match.mockResolvedValue(
      new Map([['OXXO GAS 0042', { ruleId: 'r1', categoryId: 'fuel' }]]),
    );
  });

  describe('ReconciliationService.reconcileLines', () => {
    it('suggests the rule category before the frequency guess', async () => {
      const prisma = mockDeep<PrismaService>();
      const categories = mockDeep<CategoriesService>();
      prisma.transaction.findMany.mockResolvedValue([]);
      prisma.recurringOccurrence.findMany.mockResolvedValue([]);
      categories.suggestCategoryForMerchant.mockResolvedValue({
        id: 'frequent',
      } as never);
      const service = new ReconciliationService(prisma, categories, rules);

      await service.reconcileLines(
        userId,
        'card-1',
        [line('l1'), line('l2', { merchant: 'FARMACIA' })],
        'statement',
      );

      expect(rules.match).toHaveBeenCalledWith(userId, [
        'OXXO GAS 0042',
        'FARMACIA',
      ]);
      const updates = prisma.importedTransaction.update.mock.calls.map(
        ([args]) => [args.where.id, args.data.suggestedCategoryId],
      );
      expect(updates).toEqual([
        ['l1', 'fuel'],
        ['l2', 'frequent'],
      ]);
      expect(categories.suggestCategoryForMerchant).toHaveBeenCalledTimes(1);
      expect(categories.suggestCategoryForMerchant).toHaveBeenCalledWith(
        userId,
        'FARMACIA',
      );
    });
  });

  describe('LineMaterializerService.materialize', () => {
    let tx: DeepMockProxy<Prisma.TransactionClient>;
    let aliases: DeepMockProxy<MerchantAliasesService>;
    let service: LineMaterializerService;

    beforeEach(() => {
      tx = mockDeep<Prisma.TransactionClient>();
      aliases = mockDeep<MerchantAliasesService>();
      let n = 0;
      tx.transaction.create.mockImplementation(
        () => ({ id: `t${++n}` }) as never,
      );
      service = new LineMaterializerService(
        mockDeep<RecurringExpensesService>(),
        rules,
        aliases,
      );
    });

    const options = (source: TransactionSource) => ({
      userId,
      accountId: 'card-1',
      source,
      matchedBy: OccurrenceMatchSource.statement,
      adjustBalance: false,
    });

    it('records where each category came from and applies aliases to the new movements', async () => {
      await service.materialize(
        tx,
        [
          line('l1', { suggestedCategoryId: 'fuel' }),
          line('l2', { merchant: 'FARMACIA', suggestedCategoryId: 'health' }),
          line('l3', { merchant: 'FARMACIA' }),
          line('l4', { status: ImportedLineStatus.ignored }),
        ],
        options(TransactionSource.statement),
      );

      const sources = tx.transaction.create.mock.calls.map(
        ([args]) => args.data.categorySource,
      );
      expect(sources).toEqual([
        CategorySource.rule,
        CategorySource.manual, // reviewed and confirmed by the user
        null,
      ]);
      expect(aliases.applyTo).toHaveBeenCalledWith(
        userId,
        ['t1', 't2', 't3'],
        tx,
      );
    });

    it('bank sync categories that are not rules come from the bank', async () => {
      await service.materialize(
        tx,
        [line('l1', { merchant: 'FARMACIA', suggestedCategoryId: 'health' })],
        options(TransactionSource.imported),
      );
      expect(tx.transaction.create.mock.calls[0][0].data.categorySource).toBe(
        CategorySource.bank,
      );
    });
  });
});
