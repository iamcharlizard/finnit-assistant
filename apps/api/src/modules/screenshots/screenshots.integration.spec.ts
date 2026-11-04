/**
 * Screenshots against a real database (OCR and S3 stubbed). Runs only with
 * SCREENSHOTS_TEST_DATABASE_URL (a throwaway database with the migrations).
 */
import { Test } from '@nestjs/testing';
import {
  AccountType,
  ImportedLineKind,
  ImportedLineStatus,
  OccurrenceMatchSource,
  ReceiptStatus,
  TransactionSource,
  TransactionType,
} from '@finnit/database';
import { PrismaService } from '../../services/prisma.service';
import { AiModelsService } from '../ai/ai-models.service';
import { NoUsableAiModelError } from '../ai/ai-models.service';
import { CategoriesService } from '../categories/categories.service';
import { MerchantAliasesService } from '../categorization/merchant-aliases.service';
import { MerchantRulesService } from '../categorization/merchant-rules.service';
import { OcrClient } from '../ocr/ocr.client';
import { RecurringExpensesService } from '../recurring-expenses/recurring-expenses.service';
import { LineMaterializerService } from '../statements/reconciliation/line-materializer.service';
import { ReconciliationService } from '../statements/reconciliation/reconciliation.service';
import { S3StorageService } from '../storage/s3-storage.service';
import { BANAMEX_SCREENSHOT } from './banamex-screenshot.fixture';
import { ScreenshotsService } from './screenshots.service';

const DATABASE_URL = process.env.SCREENSHOTS_TEST_DATABASE_URL;
const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4c00000000049454e44ae426082',
  'hex',
);

(DATABASE_URL ? describe : describe.skip)('screenshots (integration)', () => {
  let prisma: PrismaService;
  let screenshots: ScreenshotsService;
  let materializer: LineMaterializerService;
  let reconciliation: ReconciliationService;
  let userId: string;
  let cardId: string;
  const ocr = {
    isConfigured: true,
    image: jest.fn().mockResolvedValue({ ...BANAMEX_SCREENSHOT, qr: [] }),
  };
  const files = new Map<string, Buffer>();
  const storage = {
    put: jest.fn((key: string, body: Buffer) => files.set(key, body)),
    get: jest.fn((key: string) => files.get(key)),
    delete: jest.fn((key: string) => files.delete(key)),
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = DATABASE_URL;
    const module = await Test.createTestingModule({
      providers: [
        PrismaService,
        ScreenshotsService,
        ReconciliationService,
        LineMaterializerService,
        { provide: OcrClient, useValue: ocr },
        { provide: S3StorageService, useValue: storage },
        {
          provide: AiModelsService,
          useValue: {
            extractFromText: jest
              .fn()
              .mockRejectedValue(new NoUsableAiModelError('off')),
          },
        },
        {
          provide: MerchantRulesService,
          useValue: { match: jest.fn().mockResolvedValue(new Map()) },
        },
        {
          provide: CategoriesService,
          useValue: {
            suggestCategoryForMerchant: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: MerchantAliasesService,
          useValue: { applyTo: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: RecurringExpensesService,
          useValue: { markPaidInTransaction: jest.fn() },
        },
      ],
    }).compile();
    prisma = module.get(PrismaService);
    await prisma.$connect();
    screenshots = module.get(ScreenshotsService);
    // The test runs `process` itself instead of in the background.
    jest
      .spyOn(
        screenshots as unknown as { processInBackground: () => void },
        'processInBackground',
      )
      .mockImplementation(() => undefined);
    materializer = module.get(LineMaterializerService);
    reconciliation = module.get(ReconciliationService);

    const user = await prisma.user.create({
      data: { name: 'Shots', email: `shots-${Date.now()}@test.local` },
    });
    userId = user.id;
    const card = await prisma.account.create({
      data: {
        userId,
        type: AccountType.credit,
        name: 'BancaNet Personal Clásica Banamex **482- MXN',
        currency: 'MXN',
        balanceCurrent: -1000,
      },
    });
    cardId = card.id;
    // Already registered: the Smartfit charge.
    await prisma.transaction.create({
      data: {
        userId,
        accountId: cardId,
        type: TransactionType.expense,
        amount: 499,
        balanceEffect: -499,
        currency: 'MXN',
        txnDate: new Date('2026-11-02T00:00:00Z'),
        merchantName: 'Smartfit',
        source: TransactionSource.manual,
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const balance = async () =>
    Number(
      (await prisma.account.findUniqueOrThrow({ where: { id: cardId } }))
        .balanceCurrent,
    );

  it('reads the account and the movements, saves the new ones "en proceso"', async () => {
    const { id } = await screenshots.upload(userId, {
      buffer: PNG,
      size: PNG.length,
      originalname: 'captura.png',
    });
    await screenshots.process(id);

    let shot = await screenshots.findById(id, userId);
    expect(shot.status).toBe(ReceiptStatus.needs_review);
    expect(shot.accountHint).toBe('Clásica Banamex **482');
    expect(shot.account?.id).toBe(cardId);
    expect(shot.movementsRead).toBe(8);
    expect(shot.lines).toHaveLength(8);
    const smartfit = shot.lines.find((l) => l.merchant === 'SMARTFIT')!;
    expect(smartfit.status).toBe(ImportedLineStatus.matched);
    const didi = shot.lines.find((l) => l.merchant === 'Dïdi')!;
    expect(didi.review).toEqual(['date']);

    // The user fixes the cut-off row.
    shot = await screenshots.updateLine(didi.id, userId, {
      date: new Date('2026-11-01T00:00:00Z'),
      merchant: 'Didi',
    });
    expect(shot.lines.find((l) => l.id === didi.id)!.review).toEqual([]);

    // The same file again: the same import.
    expect(
      (await screenshots.upload(userId, { buffer: PNG, size: PNG.length })).id,
    ).toBe(id);

    const before = await balance();
    shot = await screenshots.confirm(id, userId);
    expect(shot.status).toBe(ReceiptStatus.confirmed);
    const created = await prisma.transaction.findMany({
      where: { accountId: cardId, source: TransactionSource.ocr },
    });
    expect(created).toHaveLength(7);
    // All but the cut-off row, whose status line wasn't in the screenshot.
    expect(created.filter((t) => t.inProcess)).toHaveLength(6);
    const total = 299 + 199 + 149 + 87.5 + 342.1 + 1250 + 64.3;
    expect(await balance()).toBeCloseTo(before - total, 2);
  });

  it('an overlapping screenshot does not register the same movements again', async () => {
    const other = Buffer.concat([PNG, Buffer.from([0])]);
    const { id } = await screenshots.upload(userId, {
      buffer: other,
      size: other.length,
    });
    await screenshots.process(id);
    const shot = await screenshots.findById(id, userId);
    expect([shot.status, shot.errorMessage]).toEqual([
      ReceiptStatus.needs_review,
      null,
    ]);
    // Every row is already registered (the cut-off one too: its date
    // defaults to today, within the matching window).
    expect(
      shot.lines.filter((l) => l.status === ImportedLineStatus.pending),
    ).toHaveLength(0);
    expect(shot.lines).toHaveLength(8);
  });

  it('the bank posting a movement settles it with the bank amount', async () => {
    const apple = await prisma.transaction.findFirstOrThrow({
      where: { accountId: cardId, amount: 299, inProcess: true },
    });
    const line = await prisma.importedTransaction.create({
      data: {
        accountId: cardId,
        kind: ImportedLineKind.charge,
        amount: 310,
        currency: 'MXN',
        date: new Date('2026-11-04T00:00:00Z'),
        description: 'NETFLIX.COM',
        merchant: 'NETFLIX.COM',
      },
    });
    await reconciliation.reconcileLines(userId, cardId, [line], 'bank');
    const matched = await prisma.importedTransaction.findUniqueOrThrow({
      where: { id: line.id },
    });
    expect(matched.matchedTransactionId).toBe(apple.id);

    const before = await balance();
    const result = await prisma.$transaction((tx) =>
      materializer.materialize(tx, [matched], {
        userId,
        accountId: cardId,
        source: TransactionSource.imported,
        matchedBy: OccurrenceMatchSource.bank,
        adjustBalance: true,
      }),
    );
    expect(result.settledChange).toBe(-11);
    const settled = await prisma.transaction.findUniqueOrThrow({
      where: { id: apple.id },
    });
    expect(settled.inProcess).toBe(false);
    expect(Number(settled.amount)).toBe(310);
    expect(Number(settled.balanceEffect)).toBe(-310);
    expect(await balance()).toBeCloseTo(before - 11, 2);
  });
});
