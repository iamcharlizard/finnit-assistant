/**
 * Balance by day against a real database. Runs only with
 * BALANCE_TEST_DATABASE_URL (a throwaway database with the migrations).
 */
import { Test } from '@nestjs/testing';
import { AccountType, TransactionType } from '@finnit/database';
import { PrismaService } from '../../services/prisma.service';
import { AccountsService } from './accounts.service';
import { TransactionsService } from '../transactions/transactions.service';
import { TransfersService } from '../transfers/transfers.service';
import { S3StorageService } from '../storage/s3-storage.service';
import { MerchantAliasesService } from '../categorization/merchant-aliases.service';
import { MerchantRulesService } from '../categorization/merchant-rules.service';
import { addDays, localToday } from '../../common/utils/local-date.util';

const DATABASE_URL = process.env.BALANCE_TEST_DATABASE_URL;
const key = (date: Date) => date.toISOString().slice(0, 10);

(DATABASE_URL ? describe : describe.skip)(
  'balance by day (integration)',
  () => {
    let prisma: PrismaService;
    let accounts: AccountsService;
    let transactions: TransactionsService;
    let transfers: TransfersService;
    let userId: string;

    beforeAll(async () => {
      process.env.DATABASE_URL = DATABASE_URL;
      const module = await Test.createTestingModule({
        providers: [
          PrismaService,
          AccountsService,
          TransactionsService,
          TransfersService,
          { provide: S3StorageService, useValue: {} },
          {
            provide: MerchantAliasesService,
            useValue: { applyTo: jest.fn().mockResolvedValue(undefined) },
          },
          {
            provide: MerchantRulesService,
            useValue: { categoryFor: jest.fn().mockResolvedValue(null) },
          },
        ],
      }).compile();
      prisma = module.get(PrismaService);
      await prisma.$connect();
      accounts = module.get(AccountsService);
      transactions = module.get(TransactionsService);
      transfers = module.get(TransfersService);
      const user = await prisma.user.create({
        data: {
          name: 'Balance check',
          email: `balance-${Date.now()}@test.local`,
        },
      });
      userId = user.id;
    });

    afterAll(async () => {
      await prisma.$disconnect();
    });

    it('opening and closing balance per day follow every kind of movement', async () => {
      const today = localToday();
      const day = (n: number) => addDays(today, n);
      const debit = await accounts.create(userId, {
        type: AccountType.debit,
        name: 'Débito',
        currency: 'MXN',
        initialBalance: 1_000,
      });
      const savings = await accounts.create(userId, {
        type: AccountType.savings,
        name: 'Ahorro',
        currency: 'MXN',
        initialBalance: 0,
      });
      const expense = (amount: number, date: Date, isPending = false) =>
        transactions.create(userId, {
          accountId: debit.id,
          type: TransactionType.expense,
          amount,
          currency: 'MXN',
          txnDate: date,
          isPending,
        });

      await expense(200, today);
      await transfers.create(userId, {
        fromAccountId: debit.id,
        toAccountId: savings.id,
        amount: 100,
      });
      await expense(999, today, true); // pending: not in the balance
      await accounts.setBalance(userId, { accountId: debit.id, balance: 750 });

      const history = await accounts.balanceHistory(userId, {
        accountId: debit.id,
        from: day(-1),
        to: day(5), // later than today: today
      });
      expect(history.days.map((d) => key(d.date))).toEqual([
        key(today),
        key(day(-1)),
      ]);
      const [todayRow, yesterday] = history.days;
      // 1,000 opening + −200 expense − 100 transfer + 50 balance update.
      expect(todayRow).toMatchObject({
        openingBalance: 0,
        closingBalance: 750,
        inflow: 1_050,
        outflow: 300,
        movements: 4,
        complete: true,
      });
      expect(yesterday).toMatchObject({
        closingBalance: 0,
        complete: false, // before the account was added
      });

      // An expense registered now, dated yesterday: only today's opening and
      // yesterday change; today still ends at the (lower) current balance.
      await expense(80, day(-1));
      const after = await accounts.balanceHistory(userId, {
        accountId: debit.id,
        from: day(-1),
        to: today,
      });
      expect(after.days.map((d) => d.closingBalance)).toEqual([670, -80]);

      // The incoming side of a transfer adds; confirming a pending movement
      // takes it from the balance (and adjustments keep their direction).
      const savingsHistory = await accounts.balanceHistory(userId, {
        accountId: savings.id,
        from: today,
        to: today,
      });
      expect(savingsHistory.days[0]).toMatchObject({
        openingBalance: 0,
        closingBalance: 100,
        inflow: 100,
      });
    });

    it('adds every account: money available and card debt, separately', async () => {
      const own = await prisma.user.create({
        data: { name: 'All', email: `all-${Date.now()}@test.local` },
      });
      const today = localToday();
      await accounts.create(own.id, {
        type: AccountType.debit,
        name: 'Débito',
        currency: 'MXN',
        initialBalance: 1_000,
      });
      const card = await accounts.create(own.id, {
        type: AccountType.credit,
        name: 'Tarjeta',
        currency: 'MXN',
        initialBalance: -300,
      });
      await accounts.create(own.id, {
        type: AccountType.debit,
        name: 'Dólares',
        currency: 'USD',
        initialBalance: 50,
      });
      const archived = await accounts.create(own.id, {
        type: AccountType.cash,
        name: 'Vieja',
        currency: 'MXN',
        initialBalance: 999,
      });
      await prisma.account.update({
        where: { id: archived.id },
        data: { archived: true },
      });
      await transactions.create(own.id, {
        accountId: card.id,
        type: TransactionType.expense,
        amount: 200,
        currency: 'MXN',
        txnDate: today,
      });

      const all = await accounts.allBalanceHistory(own.id, {
        from: addDays(today, -1),
        to: today,
      });
      expect(all.currency).toBe('MXN');
      expect(all.accounts).toBe(2);
      expect(all.days[0]).toMatchObject({
        availableOpening: 0,
        availableClosing: 1_000,
        debtOpening: 0,
        debtClosing: 500,
        movements: 3,
        complete: true,
      });
      expect(all.days[1].complete).toBe(false);

      const dollars = await accounts.allBalanceHistory(own.id, {
        from: today,
        to: today,
        currency: 'usd',
      });
      expect(dollars.accounts).toBe(1);
      expect(dollars.days[0].availableClosing).toBe(50);
    });

    it('rejects ranges that are backwards or too long', async () => {
      const account = await accounts.create(userId, {
        type: AccountType.cash,
        name: 'Efectivo',
        currency: 'MXN',
        initialBalance: 0,
      });
      const today = localToday();
      await expect(
        accounts.balanceHistory(userId, {
          accountId: account.id,
          from: today,
          to: addDays(today, -1),
        }),
      ).rejects.toThrow('must not be after');
      await expect(
        accounts.balanceHistory(userId, {
          accountId: account.id,
          from: addDays(today, -400),
          to: today,
        }),
      ).rejects.toThrow('At most 366 days');
    });
  },
);
