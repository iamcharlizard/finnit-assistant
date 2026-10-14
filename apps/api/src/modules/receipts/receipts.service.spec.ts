import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import {
  AiProvider,
  Prisma,
  ReceiptConfidence,
  ReceiptRoute,
  ReceiptStatus,
  TransactionSource,
  TransactionType,
} from '@finnit/database';
import { PrismaService } from '../../services/prisma.service';
import {
  AiFeatureDisabledError,
  AiModelsService,
} from '../ai/ai-models.service';
import { MerchantRulesService } from '../categorization/merchant-rules.service';
import { OcrClient, OcrUnavailableError } from '../ocr/ocr.client';
import { S3StorageService } from '../storage/s3-storage.service';
import { TransactionsService } from '../transactions/transactions.service';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../common/exceptions/graphql-error.exception';
import { localToday } from '../../common/utils/local-date.util';
import { OCR_UNAVAILABLE_MESSAGE, ReceiptsService } from './receipts.service';

const userId = '11111111-1111-4111-8111-111111111111';
const receiptId = '22222222-2222-4222-8222-222222222222';
const accountId = '33333333-3333-4333-8333-333333333333';
const categoryId = '44444444-4444-4444-8444-444444444444';
const txnId = '55555555-5555-4555-8555-555555555555';
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const iso = (date: Date) => date.toISOString().slice(0, 10);
const today = localToday();
const yesterday = new Date(today.getTime() - 86_400_000);

/** Synthetic receipt text (invented store and amounts). */
const ocrLines = (withTotal = true) => [
  'TIENDA DEMO',
  'RFC DEM0101012X3',
  `FECHA ${iso(yesterday).split('-').reverse().join('/')}`,
  'ARTICULO 100.00',
  ...(withTotal ? ['SUBTOTAL 86.21', 'IVA 13.79', 'TOTAL 100.00'] : []),
  'VISA ****4321',
];

const receiptRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: receiptId,
  userId,
  status: ReceiptStatus.needs_review,
  fileKey: `users/${userId}/receipts/${receiptId}.jpg`,
  fileName: 'ticket.jpg',
  fileHash: 'hash',
  mimeType: 'image/jpeg',
  fileSize: jpeg.length,
  route: ReceiptRoute.ocr_rules,
  confidence: ReceiptConfidence.high,
  total: new Prisma.Decimal(100),
  subtotal: null,
  tax: null,
  currency: 'MXN',
  date: yesterday,
  merchantName: 'TIENDA DEMO',
  merchantTaxId: 'DEM0101012X3',
  cardLast4: '4321',
  suggestedAccountId: null,
  suggestedCategoryId: null,
  cfdiUuid: null,
  ocrText: null,
  rawExtraction: null,
  errorMessage: null,
  transactionId: null,
  matchedTransactionId: null,
  createdAt: today,
  updatedAt: today,
  ...overrides,
});

describe('ReceiptsService', () => {
  let service: ReceiptsService;
  let prisma: DeepMockProxy<PrismaService>;
  let storage: DeepMockProxy<S3StorageService>;
  let ocr: { isConfigured: boolean; image: jest.Mock };
  let aiModels: DeepMockProxy<AiModelsService>;
  let rules: DeepMockProxy<MerchantRulesService>;
  let transactions: DeepMockProxy<TransactionsService>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    storage = mockDeep<S3StorageService>();
    aiModels = mockDeep<AiModelsService>();
    rules = mockDeep<MerchantRulesService>();
    transactions = mockDeep<TransactionsService>();
    ocr = { isConfigured: true, image: jest.fn() };
    service = new ReceiptsService(
      prisma,
      storage,
      ocr as unknown as OcrClient,
      aiModels,
      rules,
      transactions,
    );
    jest.spyOn(service['logger'], 'warn').mockImplementation(() => undefined);
    jest.spyOn(service['logger'], 'debug').mockImplementation(() => undefined);
    prisma.$transaction.mockImplementation(((fn: (tx: unknown) => unknown) =>
      fn(prisma)) as never);
    rules.categoryFor.mockResolvedValue(null);
  });

  describe('upload', () => {
    beforeEach(() => {
      jest.spyOn(service, 'process').mockResolvedValue();
    });

    it('rejects files that are not photos, by their bytes', async () => {
      await expect(
        service.upload(userId, { buffer: Buffer.from('%PDF-1.7'), size: 8 }),
      ).rejects.toThrow(ValidationError);
      expect(storage.put).not.toHaveBeenCalled();
    });

    it('rejects files over 10 MB', async () => {
      await expect(
        service.upload(userId, { buffer: jpeg, size: 11 * 1024 * 1024 }),
      ).rejects.toThrow('10 MB');
    });

    it('stores the photo under the user and starts processing', async () => {
      prisma.receiptImport.findUnique.mockResolvedValue(null);
      const result = await service.upload(userId, {
        buffer: jpeg,
        size: jpeg.length,
        originalname: '../ticket oxxo.jpg',
      });
      expect(result.status).toBe(ReceiptStatus.uploaded);
      const [key, , mime] = storage.put.mock.calls[0];
      expect(key).toBe(`users/${userId}/receipts/${result.id}.jpg`);
      expect(mime).toBe('image/jpeg');
      expect(prisma.receiptImport.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: result.id,
          userId,
          fileKey: key,
          fileName: 'ticket oxxo.jpg',
          mimeType: 'image/jpeg',
        }),
      });
      expect(service.process).toHaveBeenCalledWith(result.id);
    });

    it('returns the existing receipt for the same photo', async () => {
      prisma.receiptImport.findUnique.mockResolvedValue(receiptRow());
      const result = await service.upload(userId, { buffer: jpeg, size: 7 });
      expect(result).toEqual({
        id: receiptId,
        status: ReceiptStatus.needs_review,
      });
      expect(storage.put).not.toHaveBeenCalled();
    });

    it('retries a failed receipt instead of storing it again', async () => {
      prisma.receiptImport.findUnique.mockResolvedValue(
        receiptRow({ status: ReceiptStatus.failed }),
      );
      const result = await service.upload(userId, { buffer: jpeg, size: 7 });
      expect(result.status).toBe(ReceiptStatus.processing);
      expect(service.process).toHaveBeenCalledWith(receiptId);
      expect(storage.put).not.toHaveBeenCalled();
    });

    it('deletes the stored object when the row cannot be created', async () => {
      prisma.receiptImport.findUnique.mockResolvedValue(null);
      prisma.receiptImport.create.mockRejectedValue(new Error('db down'));
      await expect(
        service.upload(userId, { buffer: jpeg, size: 7 }),
      ).rejects.toThrow('db down');
      expect(storage.delete).toHaveBeenCalledWith(storage.put.mock.calls[0][0]);
    });
  });

  describe('process', () => {
    beforeEach(() => {
      prisma.receiptImport.update.mockResolvedValue(
        receiptRow({ status: ReceiptStatus.processing }),
      );
      storage.get.mockResolvedValue(jpeg);
      prisma.merchantTaxId.findFirst.mockResolvedValue(null);
      prisma.account.findFirst.mockResolvedValue(null);
      prisma.transaction.findMany.mockResolvedValue([]);
    });

    const lastUpdate = () =>
      prisma.receiptImport.update.mock.calls.at(-1)![0].data as Record<
        string,
        unknown
      >;

    it('fails with "OCR no disponible" when the OCR service is not configured', async () => {
      ocr.isConfigured = false;
      await service.process(receiptId);
      expect(lastUpdate()).toEqual({
        status: ReceiptStatus.failed,
        errorMessage: OCR_UNAVAILABLE_MESSAGE,
      });
      expect(storage.get).not.toHaveBeenCalled();
    });

    it('fails with "OCR no disponible" when the service is down', async () => {
      ocr.image.mockRejectedValue(new OcrUnavailableError('unreachable'));
      await service.process(receiptId);
      expect(lastUpdate()).toEqual({
        status: ReceiptStatus.failed,
        errorMessage: OCR_UNAVAILABLE_MESSAGE,
      });
    });

    it('extracts the draft with suggestions and a matching movement', async () => {
      ocr.image.mockResolvedValue({
        width: 1,
        height: 1,
        lines: ocrLines().map((text) => ({ text, confidence: 1, box: [] })),
        qr: [],
      });
      prisma.merchantTaxId.findFirst.mockResolvedValue({
        name: 'Tienda Demo',
        categoryId,
      } as never);
      prisma.category.findFirst.mockResolvedValue({ id: categoryId } as never);
      prisma.account.findFirst.mockResolvedValue({ id: accountId } as never);
      prisma.transaction.findMany.mockResolvedValue([
        { id: 'far', txnDate: new Date(yesterday.getTime() - 3 * 86_400_000) },
        { id: txnId, txnDate: yesterday },
      ] as never);

      await service.process(receiptId);

      expect(ocr.image).toHaveBeenCalledWith(jpeg, 'image/jpeg');
      expect(aiModels.extractFromText).not.toHaveBeenCalled();
      expect(lastUpdate()).toMatchObject({
        status: ReceiptStatus.needs_review,
        route: ReceiptRoute.ocr_rules,
        confidence: ReceiptConfidence.high,
        total: 100,
        date: yesterday,
        merchantName: 'Tienda Demo',
        merchantTaxId: 'DEM0101012X3',
        cardLast4: '4321',
        suggestedAccountId: accountId,
        suggestedCategoryId: categoryId,
        matchedTransactionId: txnId,
      });
      const accountWhere = prisma.account.findFirst.mock.calls[0][0]!.where!;
      expect(accountWhere.OR).toEqual([
        { metadata: { path: ['last4'], equals: '4321' } },
        { linkedAccounts: { some: { mask: '4321' } } },
      ]);
      const matchWhere = prisma.transaction.findMany.mock.calls[0][0]!.where!;
      expect(matchWhere).toMatchObject({
        userId,
        accountId,
        type: TransactionType.expense,
        amount: { gte: 99.99, lte: 100.01 },
      });
    });

    it('asks the AI (text only) when the total is missing', async () => {
      ocr.image.mockResolvedValue({
        width: 1,
        height: 1,
        lines: ocrLines(false).map((text) => ({
          text,
          confidence: 1,
          box: [],
        })),
        qr: [],
      });
      aiModels.extractFromText.mockResolvedValue({
        model: { provider: AiProvider.anthropic, modelId: 'demo' },
        data: { total: 99.5, date: '2999-01-01', merchantName: 'Demo AI' },
      } as never);

      await service.process(receiptId);

      const [request, options] = aiModels.extractFromText.mock.calls[0];
      expect(options).toEqual({ feature: 'receipt_parsing' });
      expect(request.text).toContain('TIENDA DEMO');
      expect(lastUpdate()).toMatchObject({
        status: ReceiptStatus.needs_review,
        route: ReceiptRoute.ai,
        total: 99.5,
        // The OCR date wins; the AI's future date is dropped anyway.
        date: yesterday,
        merchantName: 'TIENDA DEMO',
        confidence: ReceiptConfidence.medium,
      });
    });

    it('keeps the low-confidence draft when the AI feature is off', async () => {
      ocr.image.mockResolvedValue({
        width: 1,
        height: 1,
        lines: ocrLines(false).map((text) => ({
          text,
          confidence: 1,
          box: [],
        })),
        qr: [],
      });
      aiModels.extractFromText.mockRejectedValue(
        new AiFeatureDisabledError('receipt_parsing'),
      );
      await service.process(receiptId);
      expect(lastUpdate()).toMatchObject({
        status: ReceiptStatus.needs_review,
        route: ReceiptRoute.ocr_rules,
        confidence: ReceiptConfidence.low,
        total: null,
      });
    });
  });

  describe('confirm', () => {
    const input = {
      accountId,
      total: 100,
      date: yesterday,
      merchantName: 'Tienda Demo',
    };

    beforeEach(() => {
      prisma.receiptImport.findFirst.mockResolvedValue(receiptRow());
      prisma.account.findFirst.mockResolvedValue({
        id: accountId,
        currency: 'MXN',
      } as never);
      prisma.receiptImport.updateMany.mockResolvedValue({ count: 1 });
      jest
        .spyOn(service, 'findById')
        .mockResolvedValue({ id: receiptId } as never);
    });

    it('creates the expense with the photo attached and learns the RFC', async () => {
      transactions.create.mockImplementation(async (_u, _i, options) => {
        await options!.within!(prisma, {
          id: txnId,
          categoryId,
        } as never);
        return {} as never;
      });

      await service.confirm(receiptId, userId, input);

      const [, created, options] = transactions.create.mock.calls[0];
      expect(created).toMatchObject({
        accountId,
        type: TransactionType.expense,
        amount: 100,
        currency: 'MXN',
        txnDate: yesterday,
        merchantName: 'Tienda Demo',
        description: 'Tienda Demo',
      });
      expect(options?.source).toBe(TransactionSource.ocr);

      const [from, to] = storage.copy.mock.calls[0];
      expect(from).toBe(receiptRow().fileKey);
      expect(to).toMatch(new RegExp(`^users/${userId}/attachments/.+\\.jpg$`));
      expect(prisma.attachment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ transactionId: txnId, fileKey: to }),
      });
      expect(prisma.receiptImport.updateMany.mock.calls[0][0]).toMatchObject({
        where: { id: receiptId, status: { in: ['needs_review', 'failed'] } },
        data: { status: ReceiptStatus.confirmed, transactionId: txnId },
      });
      expect(prisma.merchantTaxId.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_taxId: { userId, taxId: 'DEM0101012X3' } },
          update: expect.objectContaining({
            categoryId,
            hits: { increment: 1 },
          }),
        }),
      );
      expect(storage.delete).not.toHaveBeenCalled();
    });

    it('attaches the photo to an existing movement instead', async () => {
      prisma.transaction.findFirst.mockResolvedValue({
        id: txnId,
        categoryId,
        receiptImport: null,
        _count: { attachments: 0 },
      } as never);

      await service.confirm(receiptId, userId, {
        ...input,
        attachToTransactionId: txnId,
      });

      expect(transactions.create).not.toHaveBeenCalled();
      expect(prisma.transaction.findFirst.mock.calls[0][0]!.where).toEqual({
        id: txnId,
        userId,
      });
      expect(prisma.attachment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ transactionId: txnId }),
      });
    });

    it("refuses another user's movement (before copying anything)", async () => {
      prisma.transaction.findFirst.mockResolvedValue(null);
      await expect(
        service.confirm(receiptId, userId, {
          ...input,
          attachToTransactionId: txnId,
        }),
      ).rejects.toThrow(NotFoundError);
      expect(storage.copy).not.toHaveBeenCalled();
    });

    it('removes the copied photo when a concurrent confirm won', async () => {
      prisma.transaction.findFirst.mockResolvedValue({
        id: txnId,
        categoryId: null,
        receiptImport: null,
        _count: { attachments: 0 },
      } as never);
      prisma.receiptImport.updateMany.mockResolvedValue({ count: 0 });
      await expect(
        service.confirm(receiptId, userId, {
          ...input,
          attachToTransactionId: txnId,
        }),
      ).rejects.toThrow(ConflictError);
      expect(storage.delete).toHaveBeenCalledWith(
        storage.copy.mock.calls[0][1],
      );
    });

    it('cannot confirm twice or while processing', async () => {
      prisma.receiptImport.findFirst.mockResolvedValue(
        receiptRow({ status: ReceiptStatus.confirmed }),
      );
      await expect(service.confirm(receiptId, userId, input)).rejects.toThrow(
        ConflictError,
      );
      prisma.receiptImport.findFirst.mockResolvedValue(
        receiptRow({ status: ReceiptStatus.processing }),
      );
      await expect(service.confirm(receiptId, userId, input)).rejects.toThrow(
        'finishes processing',
      );
    });

    it('validates the total', async () => {
      await expect(
        service.confirm(receiptId, userId, { ...input, total: -5 }),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('update', () => {
    it('recomputes the matching movement with the corrected total', async () => {
      prisma.receiptImport.findFirst.mockResolvedValue(receiptRow());
      prisma.transaction.findMany.mockResolvedValue([]);
      jest
        .spyOn(service, 'findById')
        .mockResolvedValue({ id: receiptId } as never);

      await service.update(receiptId, userId, {
        total: 80.5,
        merchantName: null,
      });

      expect(prisma.receiptImport.update).toHaveBeenCalledWith({
        where: { id: receiptId },
        data: { total: 80.5, merchantName: null, matchedTransactionId: null },
      });
      expect(
        prisma.transaction.findMany.mock.calls[0][0]!.where!.amount,
      ).toEqual({
        gte: 80.49,
        lte: 80.51,
      });
    });
  });

  describe('discard', () => {
    it('marks it discarded and deletes the photo', async () => {
      prisma.receiptImport.findFirst.mockResolvedValue(receiptRow());
      await expect(service.discard(receiptId, userId)).resolves.toBe(true);
      expect(prisma.receiptImport.update.mock.calls[0][0].data).toMatchObject({
        status: ReceiptStatus.discarded,
      });
      expect(storage.delete).toHaveBeenCalledWith(receiptRow().fileKey);
    });

    it('refuses a confirmed receipt', async () => {
      prisma.receiptImport.findFirst.mockResolvedValue(
        receiptRow({ status: ReceiptStatus.confirmed }),
      );
      await expect(service.discard(receiptId, userId)).rejects.toThrow(
        ConflictError,
      );
      expect(storage.delete).not.toHaveBeenCalled();
    });
  });

  it('serves the file only to its owner', async () => {
    prisma.receiptImport.findFirst.mockResolvedValue(null);
    await expect(service.openFile(receiptId, 'someone-else')).rejects.toThrow(
      NotFoundError,
    );
    expect(prisma.receiptImport.findFirst).toHaveBeenCalledWith({
      where: { id: receiptId, userId: 'someone-else' },
    });
  });
});
