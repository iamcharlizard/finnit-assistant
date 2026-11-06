/**
 * Protected automatic names against a real database: the privacy PIN keeps
 * the pattern, the bank text and changes behind it. Runs only with
 * PRIVACY_TEST_DATABASE_URL (a throwaway database with the migrations).
 */
import { Test } from '@nestjs/testing';
import {
  AccountType,
  AliasMatchType,
  TransactionSource,
  TransactionType,
} from '@finnit/database';
import { PrismaService } from '../../services/prisma.service';
import { PrivacyLockedError } from '../../common/exceptions/graphql-error.exception';
import { hashPassword } from '../../common/utils/password.util';
import { MerchantAliasesService } from '../categorization/merchant-aliases.service';
import { MerchantRulesService } from '../categorization/merchant-rules.service';
import { TransactionsService } from '../transactions/transactions.service';
import { S3StorageService } from '../storage/s3-storage.service';
import { localToday } from '../../common/utils/local-date.util';

const DATABASE_URL = process.env.PRIVACY_TEST_DATABASE_URL;

(DATABASE_URL ? describe : describe.skip)(
  'protected automatic names (integration)',
  () => {
    let prisma: PrismaService;
    let aliases: MerchantAliasesService;
    let transactions: TransactionsService;
    let userId: string;
    let accountId: string;
    let counter = 0;

    const movement = (text: string, amount: number) =>
      prisma.transaction.create({
        data: {
          userId,
          accountId,
          type: TransactionType.expense,
          amount,
          balanceEffect: -amount,
          currency: 'MXN',
          txnDate: localToday(),
          merchantName: text,
          source: TransactionSource.imported,
          externalId: `privacy:${Date.now()}:${counter++}`,
        },
      });

    beforeAll(async () => {
      process.env.DATABASE_URL = DATABASE_URL;
      const module = await Test.createTestingModule({
        providers: [
          PrismaService,
          MerchantAliasesService,
          MerchantRulesService,
          TransactionsService,
          { provide: S3StorageService, useValue: {} },
        ],
      }).compile();
      prisma = module.get(PrismaService);
      await prisma.$connect();
      aliases = module.get(MerchantAliasesService);
      transactions = module.get(TransactionsService);
      const user = await prisma.user.create({
        data: {
          name: 'Privacy',
          email: `privacy-${Date.now()}@test.local`,
          privacyPinHash: hashPassword('2468'),
        },
      });
      userId = user.id;
      accountId = (
        await prisma.account.create({
          data: {
            userId,
            name: 'Débito',
            type: AccountType.debit,
            currency: 'MXN',
            balanceCurrent: 0,
          },
        })
      ).id;
    });

    afterAll(async () => {
      await prisma.$disconnect();
    });

    it('names past movements, hides them behind the PIN and adds up their spending', async () => {
      const first = await movement('KSK*VID ONLYFANSFPA 231020BF8MX', 150);
      await movement('KSK*VID ONLYFANSFPA 241105AA1MX', 250);
      await movement('OXXO TIENDA 123', 40);

      const rule = await aliases.create(userId, {
        matchType: AliasMatchType.contains,
        pattern: 'KSK*VID ONLYFANSFPA',
        displayName: 'Suscripción digital',
        isProtected: true,
      });
      expect(rule).toMatchObject({ isProtected: true, isPrivate: true });
      expect(rule.matchCount).toBe(2);

      // Locked: no pattern, no bank text in the detail, no changes.
      const [listed] = await aliases.list(userId, false);
      expect(listed.pattern).toBeNull();
      expect(listed.locked).toBe(true);
      const locked = await transactions.findById(first.id, userId, false);
      expect(locked.displayName).toBe('Suscripción digital');
      expect(locked.originalLocked).toBe(true);
      expect(locked.originalDescription).toBeNull();
      await expect(aliases.delete(userId, rule.id, false)).rejects.toThrow(
        PrivacyLockedError,
      );

      // Another rule can't reveal which movements they are.
      const preview = await aliases.preview(
        userId,
        {
          matchType: AliasMatchType.contains,
          pattern: 'ONLYFANS',
          displayName: '',
        },
        null,
        false,
      );
      expect(preview.count).toBe(0);
      await aliases.create(userId, {
        matchType: AliasMatchType.contains,
        pattern: 'ONLYFANS',
        displayName: 'Otro nombre',
        priority: 1000,
      });
      const stillProtected = await transactions.findById(
        first.id,
        userId,
        false,
      );
      expect(stillProtected.displayName).toBe('Suscripción digital');

      // Unlocked: everything shows.
      const open = await transactions.findById(first.id, userId, true);
      expect(open.originalDescription).toBe('KSK*VID ONLYFANSFPA 231020BF8MX');
      expect(open.aliasRule?.pattern).toBe('KSK*VID ONLYFANSFPA');

      const spending = await aliases.spending(
        userId,
        new Date(Date.now() - 86_400_000 * 40),
        new Date(Date.now() + 86_400_000),
      );
      expect(spending.get(rule.id)).toEqual({
        count: 2,
        total: 400,
        currency: 'MXN',
      });

      // History filtered by the automatic name (own names excluded).
      await transactions.setAlias(first.id, userId, {
        displayName: 'Solo este',
      });
      const page = await transactions.findMany(userId, {
        first: 10,
        filters: { aliasId: rule.id },
      });
      expect(page.totalCount).toBe(1);
    });
  },
);
