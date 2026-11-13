/**
 * Turning movements into transfers, transfer suggestions and categorizing
 * from history, against a real database. Runs only with
 * TRANSFERS_TEST_DATABASE_URL (a throwaway database with the migrations).
 */
import { Test } from '@nestjs/testing';
import {
  AccountType,
  CategorySource,
  TransactionSource,
  TransactionType,
  TransferSuggestionReason,
  TransferSuggestionStatus,
} from '@finnit/database';
import { PrismaService } from '../../services/prisma.service';
import { MerchantAliasesService } from '../categorization/merchant-aliases.service';
import { MerchantRulesService } from '../categorization/merchant-rules.service';
import { CategorizationService } from '../categorization/categorization.service';
import { AiModelsService } from '../ai/ai-models.service';
import { addDays, localToday } from '../../common/utils/local-date.util';
import { TransfersService } from './transfers.service';
import { TransferConversionService } from './transfer-conversion.service';
import { TransferSuggestionsService } from './transfer-suggestions.service';
import { TransferSuggestionAction } from './dto/transfer-suggestion.dto';
import { ReportsService } from '../reports/reports.service';
import {
  CANCELLABLE_SELECT,
  cancelMovement,
  restoreMovement,
} from '../../common/utils/cancel-movement.util';
import { statusWhere } from '../transactions/transactions.service';
import { TransactionStatus } from '../transactions/dto/transaction.dto';

const DATABASE_URL = process.env.TRANSFERS_TEST_DATABASE_URL;

(DATABASE_URL ? describe : describe.skip)(
  'transfers between own accounts (integration)',
  () => {
    let prisma: PrismaService;
    let conversion: TransferConversionService;
    let suggestions: TransferSuggestionsService;
    let categorization: CategorizationService;
    let aliases: MerchantAliasesService;
    let userId: string;
    let debitId: string;
    let savingsId: string;
    let counter = 0;
    const today = localToday();

    const balance = async (id: string) =>
      Number(
        (await prisma.account.findUniqueOrThrow({ where: { id } }))
          .balanceCurrent,
      );

    /** A movement as a bank sync leaves it (the balance already moved). */
    const bankMovement = async (
      accountId: string,
      type: TransactionType,
      amount: number,
      description: string,
      day = today,
    ) => {
      const effect = type === TransactionType.income ? amount : -amount;
      const row = await prisma.transaction.create({
        data: {
          userId,
          accountId,
          type,
          amount,
          balanceEffect: effect,
          currency: 'MXN',
          txnDate: day,
          description,
          source: TransactionSource.imported,
          externalId: `test:${Date.now()}:${counter++}`,
        },
      });
      await prisma.account.update({
        where: { id: accountId },
        data: { balanceCurrent: { increment: effect } },
      });
      return row;
    };

    beforeAll(async () => {
      process.env.DATABASE_URL = DATABASE_URL;
      const module = await Test.createTestingModule({
        providers: [
          PrismaService,
          TransfersService,
          TransferConversionService,
          TransferSuggestionsService,
          MerchantAliasesService,
          MerchantRulesService,
          CategorizationService,
          ReportsService,
          { provide: AiModelsService, useValue: {} },
        ],
      }).compile();
      prisma = module.get(PrismaService);
      await prisma.$connect();
      conversion = module.get(TransferConversionService);
      suggestions = module.get(TransferSuggestionsService);
      categorization = module.get(CategorizationService);
      aliases = module.get(MerchantAliasesService);

      const user = await prisma.user.create({
        data: {
          name: 'Transfers',
          email: `transfers-${Date.now()}@test.local`,
        },
      });
      userId = user.id;
      const account = (
        name: string,
        type: AccountType,
        balanceCurrent: number,
      ) =>
        prisma.account.create({
          data: { userId, name, type, currency: 'MXN', balanceCurrent },
        });
      debitId = (await account('Débito', AccountType.debit, 10_000)).id;
      savingsId = (await account('Ahorro', AccountType.savings, 0)).id;
    });

    afterAll(async () => {
      await prisma.$disconnect();
    });

    it('converts an expense, creating the other side, and undoes it', async () => {
      const expense = await bankMovement(
        debitId,
        TransactionType.expense,
        2_000,
        'P INT 0311026 Transferencia interbancaria',
      );
      const debitBefore = await balance(debitId);
      const savingsBefore = await balance(savingsId);

      const transfer = await conversion.convert(userId, {
        transactionId: expense.id,
        counterpartAccountId: savingsId,
      });
      expect(transfer.fromTxnId).toBe(expense.id);
      expect(transfer.convertedAt).toBeInstanceOf(Date);
      expect(await balance(debitId)).toBe(debitBefore);
      expect(await balance(savingsId)).toBe(savingsBefore + 2_000);
      const source = await prisma.transaction.findUniqueOrThrow({
        where: { id: expense.id },
      });
      expect(source.type).toBe(TransactionType.transfer);
      expect(source.originalType).toBe(TransactionType.expense);
      expect(Number(source.balanceEffect)).toBe(-2_000);

      await conversion.undo(userId, transfer.id);
      expect(
        (
          await prisma.transaction.findUniqueOrThrow({
            where: { id: expense.id },
          })
        ).type,
      ).toBe(TransactionType.expense);
      expect(
        await prisma.transaction.findUnique({
          where: { id: transfer.toTxnId },
        }),
      ).toBeNull();
      expect(await balance(debitId)).toBe(debitBefore);
      expect(await balance(savingsId)).toBe(savingsBefore);
    });

    it('finds a card payment that showed up days apart, or months apart', async () => {
      const card = await prisma.account.create({
        data: {
          userId,
          name: 'Tarjeta',
          type: AccountType.credit,
          currency: 'MXN',
          balanceCurrent: -5_000,
        },
      });
      // Paid on Friday the 31st; the bank shows it on Monday the 3rd.
      const paid = await bankMovement(
        debitId,
        TransactionType.expense,
        3_210.55,
        'PAGO TARJETA',
        new Date('2026-11-03T00:00:00.000Z'),
      );
      const cardSide = (day: string) =>
        prisma.transaction.create({
          data: {
            userId,
            accountId: card.id,
            type: TransactionType.adjustment,
            amount: 3_210.55,
            balanceEffect: 3_210.55,
            currency: 'MXN',
            txnDate: new Date(`${day}T00:00:00.000Z`),
            description: 'SU PAGO GRACIAS',
            source: TransactionSource.imported,
          },
        });
      const far = await cardSide('2026-08-30');
      const near = await cardSide('2026-10-31');

      const found = await conversion.candidates(userId, paid.id, card.id);
      expect(found.map((c) => c.id)).toEqual([near.id, far.id]);

      // Picked by hand, a far one links too.
      const transfer = await conversion.convert(userId, {
        transactionId: paid.id,
        counterpartAccountId: card.id,
        counterpartTransactionId: far.id,
      });
      expect(transfer.toTxnId).toBe(far.id);
      await conversion.undo(userId, transfer.id);
    });

    it('leaves categories out of the totals out of the reports', async () => {
      const reports = new ReportsService(prisma);
      const category = (name: string, excludeFromTotals: boolean) =>
        prisma.category.create({
          data: { userId, name, kind: 'expense', excludeFromTotals },
        });
      const counted = await category('Comida', false);
      const untracked = await category('Sin seguimiento', true);
      const day = new Date('2025-03-10T00:00:00.000Z');
      const spend = async (amount: number, categoryId: string) => {
        const row = await bankMovement(
          debitId,
          TransactionType.expense,
          amount,
          'X',
          day,
        );
        await prisma.transaction.update({
          where: { id: row.id },
          data: { categoryId },
        });
      };
      await spend(100, counted.id);
      await spend(900, untracked.id);

      const report = await reports.getMonthlyReport(userId, 2025, 3);
      expect(report.totalExpenses).toBe(100);
      expect(report.categoryBreakdown.map((c) => c.categoryId)).toEqual([
        counted.id,
      ]);
      const flow = await reports.getDailyCashFlow(
        userId,
        '2025-03-10',
        '2025-03-10',
      );
      expect(flow[0]!.expenses).toBe(100);
    });

    it('a cancelled card charge counts nowhere until reactivated', async () => {
      const reports = new ReportsService(prisma);
      const card = await prisma.account.create({
        data: {
          userId,
          name: 'Tarjeta cancelaciones',
          type: AccountType.credit,
          currency: 'MXN',
          balanceCurrent: 0,
        },
      });
      const day = new Date('2025-05-12T00:00:00.000Z');
      const charge = await bankMovement(
        card.id,
        TransactionType.expense,
        1_250,
        'AMAZON CANCELADO',
        day,
      );
      expect(await balance(card.id)).toBe(-1_250);
      const spentBefore = (await reports.getMonthlyReport(userId, 2025, 5))
        .totalExpenses;

      const load = () =>
        prisma.transaction.findUniqueOrThrow({
          where: { id: charge.id },
          select: CANCELLABLE_SELECT,
        });
      await prisma.$transaction(async (tx) => cancelMovement(tx, await load()));
      expect(await balance(card.id)).toBe(0);
      expect(
        (await reports.getMonthlyReport(userId, 2025, 5)).totalExpenses,
      ).toBe(spentBefore - 1_250);
      const cancelled = await prisma.transaction.findMany({
        where: {
          accountId: card.id,
          OR: statusWhere([TransactionStatus.cancelled]),
        },
        select: { id: true },
      });
      expect(cancelled.map((t) => t.id)).toEqual([charge.id]);

      await prisma.$transaction(async (tx) =>
        restoreMovement(tx, await load()),
      );
      expect(await balance(card.id)).toBe(-1_250);
      expect(
        (await reports.getMonthlyReport(userId, 2025, 5)).totalExpenses,
      ).toBe(spentBefore);
    });

    it('suggests the pair found in two synced accounts and links it', async () => {
      const out = await bankMovement(
        debitId,
        TransactionType.expense,
        3_500,
        'SPEI ENVIADO AHORRO',
      );
      const arrived = await bankMovement(
        savingsId,
        TransactionType.income,
        3_500,
        'DEPOSITO SPEI',
        addDays(today, 1),
      );
      const before = [await balance(debitId), await balance(savingsId)];

      await expect(
        suggestions.detect(userId, [out.id, arrived.id]),
      ).resolves.toBe(1);
      const page = await suggestions.list(userId, { first: 10 });
      const suggestion = page.edges
        .map((edge) => edge.node)
        .find((node) => node.transaction.id === out.id);
      expect(suggestion).toMatchObject({
        reason: TransferSuggestionReason.pair,
        counterpartAccountId: savingsId,
      });
      expect(suggestion!.counterpartTransaction?.id).toBe(arrived.id);

      await suggestions.resolve(userId, suggestion!.id, {
        action: TransferSuggestionAction.to_account,
      });
      const transfer = await prisma.transfer.findUniqueOrThrow({
        where: { fromTxnId: out.id },
      });
      expect(transfer.toTxnId).toBe(arrived.id);
      expect([await balance(debitId), await balance(savingsId)]).toEqual(
        before,
      );
      expect(
        (
          await prisma.transferSuggestion.findUniqueOrThrow({
            where: { id: suggestion!.id },
          })
        ).status,
      ).toBe(TransferSuggestionStatus.accepted);
      // Reviewed: never suggested again.
      await expect(
        suggestions.detect(userId, [out.id, arrived.id]),
      ).resolves.toBe(0);
    });

    it('remembers a payment to someone else and stops suggesting it', async () => {
      const first = await bankMovement(
        debitId,
        TransactionType.expense,
        1_200,
        'P TER 0000031126 JUAN PEREZ LOPEZ',
        addDays(today, -10),
      );
      await expect(suggestions.detect(userId, [first.id])).resolves.toBe(1);
      const suggestion = await prisma.transferSuggestion.findUniqueOrThrow({
        where: { transactionId: first.id },
      });
      expect(suggestion.reason).toBe(TransferSuggestionReason.text);

      await suggestions.resolve(userId, suggestion.id, {
        action: TransferSuggestionAction.to_someone,
        description: 'Renta a Juan',
        remember: true,
      });
      expect(
        (
          await prisma.transaction.findUniqueOrThrow({
            where: { id: first.id },
          })
        ).aliasName,
      ).toBe('Renta a Juan');

      const next = await bankMovement(
        debitId,
        TransactionType.expense,
        1_200,
        'P TER 0000045678 JUAN PEREZ LOPEZ',
        addDays(today, -3),
      );
      await aliases.applyTo(userId, [next.id]);
      await expect(suggestions.detect(userId, [next.id])).resolves.toBe(0);
    });

    it('categorizes from past categorizations and counts what is left', async () => {
      const category = await prisma.category.create({
        data: { userId, name: 'Transporte' },
      });
      for (const day of [-40, -20]) {
        const past = await bankMovement(
          debitId,
          TransactionType.expense,
          90,
          `UBER TRIP ${day}`,
          addDays(today, day),
        );
        await prisma.transaction.update({
          where: { id: past.id },
          data: {
            categoryId: category.id,
            categorySource: CategorySource.manual,
          },
        });
      }
      const fresh = await bankMovement(
        debitId,
        TransactionType.expense,
        120,
        'UBER TRIP 0451',
      );
      const unknown = await bankMovement(
        debitId,
        TransactionType.expense,
        50,
        'TIENDITA DON PEPE',
      );

      const result = await categorization.autoCategorize(userId);
      expect(result.categorized).toBeGreaterThanOrEqual(1);
      expect(
        (
          await prisma.transaction.findUniqueOrThrow({
            where: { id: fresh.id },
          })
        ).categoryId,
      ).toBe(category.id);
      expect(
        (
          await prisma.transaction.findUniqueOrThrow({
            where: { id: unknown.id },
          })
        ).categoryId,
      ).toBeNull();
      expect(result.remaining).toBe(
        await categorization.uncategorizedCount(userId),
      );
    });
  },
);
