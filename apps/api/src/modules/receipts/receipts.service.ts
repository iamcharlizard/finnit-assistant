import { createHash, randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import {
  Prisma,
  ReceiptRoute,
  ReceiptStatus,
  TransactionSource,
  TransactionType,
} from '@finnit/database';
import { PrismaService } from '../../services/prisma.service';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../common/exceptions/graphql-error.exception';
import { PaginationUtil } from '../../common/utils/pagination.util';
import {
  addDays,
  localToday,
  toLocalDateOnly,
} from '../../common/utils/local-date.util';
import { AccountMetadata } from '../../common/types/models/account-metadata.model';
import { Account } from '../../common/types/models/account.model';
import { AiModelsService, NoUsableAiModelError } from '../ai/ai-models.service';
import { AiProviderError } from '../ai/providers/ai-provider';
import {
  MerchantRulesService,
  ruleText,
} from '../categorization/merchant-rules.service';
import { OcrClient, OcrError, OcrRejectedError } from '../ocr/ocr.client';
import {
  S3StorageService,
  type StoredObject,
} from '../storage/s3-storage.service';
import { detectFileType, safeFileName } from '../storage/file-type.util';
import {
  MAX_ATTACHMENTS_PER_TRANSACTION,
  TransactionsService,
} from '../transactions/transactions.service';
import {
  TRANSACTION_PRESENTATION_INCLUDE,
  mapCategory,
  mapTransaction,
} from '../transactions/transaction.mapper';
import {
  ConfirmReceiptImportInput,
  MAX_MERCHANT_NAME_LENGTH,
  MAX_RECEIPT_DESCRIPTION_LENGTH,
  ReceiptImport,
  ReceiptImportConnection,
  ReceiptImportsArgs,
  UpdateReceiptImportInput,
} from './dto/receipt.dto';
import { extractReceipt, receiptConfidence } from './receipt-rules';
import { extractReceiptWithAi } from './receipt-ai';

export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
export const RECEIPT_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
]);
/** Shown to the user when the OCR service is not configured or down. */
export const OCR_UNAVAILABLE_MESSAGE = 'OCR no disponible';
export const OCR_REJECTED_MESSAGE = 'No se pudo leer la imagen';
const PROCESS_FAILED_MESSAGE = 'No se pudo procesar el ticket';

const MATCH_AMOUNT_TOLERANCE = 0.01;
const MATCH_DAYS_WINDOW = 3;

export interface UploadedReceiptFile {
  buffer: Buffer;
  size: number;
  originalname?: string;
}

const TRANSACTION_INCLUDE = {
  ...TRANSACTION_PRESENTATION_INCLUDE,
  account: true,
  category: true,
  attachments: { orderBy: { uploadedAt: 'asc' } },
} satisfies Prisma.TransactionInclude;

const RECEIPT_INCLUDE = {
  suggestedAccount: true,
  suggestedCategory: true,
  matchedTransaction: { include: TRANSACTION_INCLUDE },
  transaction: { include: TRANSACTION_INCLUDE },
} satisfies Prisma.ReceiptImportInclude;

type ReceiptRow = Prisma.ReceiptImportGetPayload<{
  include: typeof RECEIPT_INCLUDE;
}>;
type PlainReceiptRow = Prisma.ReceiptImportGetPayload<Record<string, never>>;

/** Statuses in which the user can still edit, confirm or discard. */
const REVIEWABLE: ReceiptStatus[] = [
  ReceiptStatus.needs_review,
  ReceiptStatus.failed,
];

/**
 * Receipt photos (feature 14): upload → OCR → local rules → (AI fallback)
 * → draft the user reviews → confirm (new expense, or the photo attached
 * to an existing movement) or discard.
 */
@Injectable()
export class ReceiptsService {
  private readonly logger = new Logger(ReceiptsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: S3StorageService,
    private readonly ocr: OcrClient,
    private readonly aiModels: AiModelsService,
    private readonly rules: MerchantRulesService,
    private readonly transactions: TransactionsService,
  ) {}

  /**
   * Stores the photo and starts extraction in the background. The same photo
   * again returns the existing receipt (a failed one is retried; a discarded
   * one starts over).
   */
  async upload(
    userId: string,
    file: UploadedReceiptFile,
  ): Promise<{ id: string; status: ReceiptStatus }> {
    if (file.size > MAX_RECEIPT_BYTES) {
      throw new ValidationError('The file exceeds 10 MB');
    }
    const type = detectFileType(file.buffer);
    if (!type || !RECEIPT_MIME_TYPES.has(type.mime)) {
      throw new ValidationError(
        'Only JPEG, PNG, WEBP or HEIC photos are allowed',
      );
    }

    const fileHash = createHash('sha256').update(file.buffer).digest('hex');
    const existing = await this.prisma.receiptImport.findUnique({
      where: { userId_fileHash: { userId, fileHash } },
    });
    if (existing?.status === ReceiptStatus.failed) {
      this.processInBackground(existing.id);
      return { id: existing.id, status: ReceiptStatus.processing };
    }
    if (existing?.status === ReceiptStatus.discarded) {
      await this.prisma.receiptImport.delete({ where: { id: existing.id } });
    } else if (existing) {
      return { id: existing.id, status: existing.status };
    }

    const id = randomUUID();
    const fileKey = S3StorageService.key(
      userId,
      'receipts',
      id,
      type.extension,
    );
    await this.storage.put(fileKey, file.buffer, type.mime);
    try {
      await this.prisma.receiptImport.create({
        data: {
          id,
          userId,
          fileKey,
          fileHash,
          fileName: safeFileName(file.originalname, `ticket.${type.extension}`),
          mimeType: type.mime,
          fileSize: file.size,
        },
      });
    } catch (error) {
      await this.storage.delete(fileKey);
      // The same photo uploaded twice at once: return the first one.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const first = await this.prisma.receiptImport.findUnique({
          where: { userId_fileHash: { userId, fileHash } },
        });
        if (first) return { id: first.id, status: first.status };
      }
      throw error;
    }

    this.processInBackground(id);
    return { id, status: ReceiptStatus.uploaded };
  }

  private processInBackground(id: string) {
    // Runs in-process (single API replica). The client polls `receiptImport`.
    void this.process(id).catch((error: Error) =>
      this.logger.error(`Receipt ${id} processing crashed`, error),
    );
  }

  /** OCR → rules → (AI) → suggestions. Never throws. */
  async process(id: string): Promise<void> {
    const receipt = await this.prisma.receiptImport.update({
      where: { id },
      data: { status: ReceiptStatus.processing, errorMessage: null },
    });
    const userId = receipt.userId;

    try {
      if (!this.ocr.isConfigured) {
        await this.fail(id, OCR_UNAVAILABLE_MESSAGE);
        return;
      }
      const image = await this.storage.get(receipt.fileKey);
      const ocr = await this.ocr.image(image, receipt.mimeType);
      const lines = ocr.lines.map((line) => line.text);
      const ocrText = lines.join('\n');
      const today = localToday();

      const rules = extractReceipt({
        lines,
        codes: ocr.qr.map((code) => code.text),
        today,
      });
      let { route, confidence, total, date, merchantName } = rules;
      let merchantTaxId = rules.merchantTaxId;

      // AI only when the local rules miss the total or the date.
      let ai: { model: string; fields: object } | undefined;
      if ((total === undefined || !date) && ocrText.trim()) {
        ai = await this.tryAi(id, ocrText, today);
        const fields = ai?.fields as
          | Awaited<ReturnType<typeof extractReceiptWithAi>>['fields']
          | undefined;
        if (fields && (fields.total !== undefined || fields.date)) {
          total ??= fields.total;
          date ??= fields.date;
          merchantTaxId ??= fields.taxId;
          merchantName ??= fields.merchantName;
          route = rules.cfdi ? ReceiptRoute.cfdi_qr : ReceiptRoute.ai;
          confidence = receiptConfidence({
            total,
            date,
            checks: rules.checks,
            hasQrTotal: Boolean(rules.cfdi),
          });
        }
      }

      // What the user (or everyone) already taught us about this RFC.
      const known = merchantTaxId
        ? await this.prisma.merchantTaxId.findFirst({
            where: {
              taxId: merchantTaxId,
              OR: [{ userId }, { userId: null }],
            },
            orderBy: [{ userId: { sort: 'asc', nulls: 'last' } }],
          })
        : null;
      if (known) merchantName = known.name;

      const suggestedAccountId = rules.cardLast4
        ? await this.accountForLast4(userId, rules.cardLast4)
        : null;
      const suggestedCategoryId =
        (known?.categoryId &&
          (await this.ownCategory(userId, known.categoryId))) ||
        (await this.rules.categoryFor(userId, ruleText({ merchantName })));
      const dateOnly = date ? new Date(`${date}T00:00:00.000Z`) : null;
      const matchedTransactionId =
        total !== undefined && dateOnly
          ? await this.findMatch(userId, total, dateOnly, suggestedAccountId)
          : null;

      await this.prisma.receiptImport.update({
        where: { id },
        data: {
          status: ReceiptStatus.needs_review,
          route,
          confidence,
          total: total ?? null,
          subtotal: rules.subtotal ?? null,
          tax: rules.tax ?? null,
          date: dateOnly,
          merchantName:
            merchantName?.slice(0, MAX_MERCHANT_NAME_LENGTH) ?? null,
          merchantTaxId: merchantTaxId ?? null,
          cardLast4: rules.cardLast4 ?? null,
          cfdiUuid: rules.cfdi?.uuid ?? null,
          suggestedAccountId,
          suggestedCategoryId: suggestedCategoryId ?? null,
          matchedTransactionId,
          ocrText,
          rawExtraction: {
            rules: { ...rules },
            ocr: {
              width: ocr.width,
              height: ocr.height,
              lines: lines.length,
              codes: ocr.qr.length,
              timingsMs: ocr.timingsMs ?? null,
            },
            ...(ai && { ai }),
          } as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      const message =
        error instanceof OcrRejectedError
          ? OCR_REJECTED_MESSAGE
          : error instanceof OcrError
            ? OCR_UNAVAILABLE_MESSAGE
            : PROCESS_FAILED_MESSAGE;
      this.logger.warn(
        `Receipt ${id} failed: ${(error as Error).message ?? message}`,
      );
      await this.fail(id, message);
    }
  }

  private async fail(id: string, message: string) {
    await this.prisma.receiptImport.update({
      where: { id },
      data: { status: ReceiptStatus.failed, errorMessage: message },
    });
  }

  /** The AI fallback's fields, or undefined when it is off or fails. */
  private async tryAi(id: string, ocrText: string, today: Date) {
    try {
      return await extractReceiptWithAi(this.aiModels, ocrText, today);
    } catch (error) {
      if (
        error instanceof NoUsableAiModelError ||
        error instanceof AiProviderError
      ) {
        this.logger.debug(`Receipt ${id}: no AI fallback (${error.message})`);
        return undefined;
      }
      throw error;
    }
  }

  /** The user's active account whose last 4 digits match the card. */
  private async accountForLast4(
    userId: string,
    last4: string,
  ): Promise<string | null> {
    const account = await this.prisma.account.findFirst({
      where: {
        userId,
        archived: false,
        OR: [
          { metadata: { path: ['last4'], equals: last4 } },
          { linkedAccounts: { some: { mask: last4 } } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    return account?.id ?? null;
  }

  private async ownCategory(
    userId: string,
    categoryId: string,
  ): Promise<string | null> {
    const category = await this.prisma.category.findFirst({
      where: {
        id: categoryId,
        OR: [{ userId }, { userId: null, isDefault: true }],
      },
      select: { id: true },
    });
    return category?.id ?? null;
  }

  /**
   * An existing expense that looks like this receipt: same amount (±0.01),
   * within 3 days, in the suggested account when there is one, and without
   * a receipt of its own. Closest date first.
   */
  private async findMatch(
    userId: string,
    total: number,
    date: Date,
    accountId: string | null,
  ): Promise<string | null> {
    const candidates = await this.prisma.transaction.findMany({
      where: {
        userId,
        ...(accountId && { accountId }),
        type: TransactionType.expense,
        amount: {
          gte: roundMoney(total - MATCH_AMOUNT_TOLERANCE),
          lte: roundMoney(total + MATCH_AMOUNT_TOLERANCE),
        },
        txnDate: {
          gte: addDays(date, -MATCH_DAYS_WINDOW),
          lte: addDays(date, MATCH_DAYS_WINDOW),
        },
        receiptImport: { is: null },
      },
      select: { id: true, txnDate: true },
      orderBy: [{ txnDate: 'desc' }, { createdAt: 'desc' }],
      take: 10,
    });
    const distance = (d: Date) => Math.abs(d.getTime() - date.getTime());
    candidates.sort((a, b) => distance(a.txnDate) - distance(b.txnDate));
    return candidates[0]?.id ?? null;
  }

  async findMany(
    userId: string,
    args: ReceiptImportsArgs,
  ): Promise<ReceiptImportConnection> {
    const where: Prisma.ReceiptImportWhereInput = { userId };
    const first = Math.min(Math.max(args.first ?? 20, 1), 100);
    const [rows, totalCount] = await Promise.all([
      this.prisma.receiptImport.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: first,
        include: RECEIPT_INCLUDE,
        ...(args.after && {
          cursor: { id: PaginationUtil.decodeCursor(args.after) },
          skip: 1,
        }),
      }),
      this.prisma.receiptImport.count({ where }),
    ]);
    return PaginationUtil.createConnection(
      rows.map((row) => this.map(row)),
      { first, after: args.after },
      totalCount,
      (receipt) => PaginationUtil.encodeCursor(receipt.id),
    );
  }

  async findById(id: string, userId: string): Promise<ReceiptImport> {
    const row = await this.prisma.receiptImport.findFirst({
      where: { id, userId },
      include: RECEIPT_INCLUDE,
    });
    if (!row) throw new NotFoundError('Receipt not found');
    return this.map(row);
  }

  /** The photo, only for its owner. */
  async openFile(
    id: string,
    userId: string,
  ): Promise<{ file: StoredObject; fileName: string; mimeType: string }> {
    const receipt = await this.getOwned(id, userId);
    if (receipt.status === ReceiptStatus.discarded) {
      throw new NotFoundError('This receipt was discarded');
    }
    return {
      file: await this.storage.open(receipt.fileKey),
      fileName: receipt.fileName ?? `ticket-${id}`,
      mimeType: receipt.mimeType,
    };
  }

  async update(
    id: string,
    userId: string,
    input: UpdateReceiptImportInput,
  ): Promise<ReceiptImport> {
    const receipt = await this.getOwned(id, userId);
    this.assertReviewable(receipt);

    const data: Prisma.ReceiptImportUncheckedUpdateInput = {};
    if (input.total !== undefined) {
      data.total = input.total === null ? null : validTotal(input.total);
    }
    if (input.date !== undefined) {
      data.date = input.date === null ? null : validDate(input.date);
    }
    if (input.merchantName !== undefined) {
      data.merchantName = cleanText(
        input.merchantName,
        MAX_MERCHANT_NAME_LENGTH,
        'merchantName',
      );
    }
    if (input.accountId !== undefined) {
      if (input.accountId) await this.getAccount(input.accountId, userId);
      data.suggestedAccountId = input.accountId || null;
    }
    if (input.categoryId !== undefined) {
      if (input.categoryId) {
        if (!(await this.ownCategory(userId, input.categoryId))) {
          throw new NotFoundError('Category not found');
        }
      }
      data.suggestedCategoryId = input.categoryId || null;
    }

    // The amount, day or account changed: look for a matching movement again.
    const total =
      data.total !== undefined
        ? (data.total as number | null)
        : receipt.total === null
          ? null
          : Number(receipt.total);
    const date =
      data.date !== undefined ? (data.date as Date | null) : receipt.date;
    const accountId =
      data.suggestedAccountId !== undefined
        ? (data.suggestedAccountId as string | null)
        : receipt.suggestedAccountId;
    data.matchedTransactionId =
      total !== null && date
        ? await this.findMatch(userId, total, date, accountId)
        : null;

    await this.prisma.receiptImport.update({ where: { id }, data });
    return this.findById(id, userId);
  }

  /**
   * Turns the draft into data. With `attachToTransactionId` the photo is
   * attached to that existing movement (no new expense, no double count);
   * otherwise a new expense is created with the photo attached. The user's
   * RFC → name → category table learns from it.
   */
  async confirm(
    id: string,
    userId: string,
    input: ConfirmReceiptImportInput,
  ): Promise<ReceiptImport> {
    const receipt = await this.getOwned(id, userId);
    this.assertReviewable(receipt);

    const total = validTotal(input.total);
    const date = validDate(input.date);
    const merchantName =
      cleanText(input.merchantName, MAX_MERCHANT_NAME_LENGTH, 'merchantName') ??
      receipt.merchantName;
    const description = cleanText(
      input.description,
      MAX_RECEIPT_DESCRIPTION_LENGTH,
      'description',
    );
    const account = await this.getAccount(input.accountId, userId);
    if (
      input.categoryId &&
      !(await this.ownCategory(userId, input.categoryId))
    ) {
      throw new NotFoundError('Category not found');
    }

    const attachmentId = randomUUID();
    const extension = receipt.fileKey.split('.').pop()!;
    const attachmentKey = S3StorageService.key(
      userId,
      'attachments',
      attachmentId,
      extension,
    );

    const finish = async (
      tx: Prisma.TransactionClient,
      transactionId: string,
      categoryId: string | null,
    ) => {
      // Only one confirm wins when two arrive at once.
      const claimed = await tx.receiptImport.updateMany({
        where: { id, userId, status: { in: REVIEWABLE } },
        data: {
          status: ReceiptStatus.confirmed,
          transactionId,
          total,
          date,
          merchantName,
          suggestedAccountId: account.id,
          suggestedCategoryId: categoryId,
          errorMessage: null,
        },
      });
      if (claimed.count === 0) {
        throw new ConflictError('This receipt was already confirmed');
      }
      await tx.attachment.create({
        data: {
          id: attachmentId,
          transactionId,
          fileKey: attachmentKey,
          fileName: receipt.fileName ?? `ticket.${extension}`,
          fileType: receipt.mimeType,
          fileSize: receipt.fileSize,
          extra: { receiptImportId: id },
        },
      });
      if (receipt.merchantTaxId && merchantName) {
        await tx.merchantTaxId.upsert({
          where: {
            userId_taxId: { userId, taxId: receipt.merchantTaxId },
          },
          create: {
            userId,
            taxId: receipt.merchantTaxId,
            name: merchantName.slice(0, MAX_MERCHANT_NAME_LENGTH),
            categoryId,
            hits: 1,
          },
          update: {
            name: merchantName.slice(0, MAX_MERCHANT_NAME_LENGTH),
            ...(categoryId && { categoryId }),
            hits: { increment: 1 },
          },
        });
      }
    };

    const target = input.attachToTransactionId
      ? await this.attachTarget(input.attachToTransactionId, userId, id)
      : null;

    // The photo is copied, so the receipt and the attachment can each be
    // deleted on their own.
    await this.storage.copy(receipt.fileKey, attachmentKey);
    try {
      if (target) {
        await this.prisma.$transaction((tx) =>
          finish(tx, target.id, input.categoryId ?? target.categoryId),
        );
      } else {
        const categoryId =
          input.categoryId ??
          (receipt.suggestedCategoryId
            ? await this.ownCategory(userId, receipt.suggestedCategoryId)
            : null);
        await this.transactions.create(
          userId,
          {
            accountId: account.id,
            categoryId: categoryId ?? undefined,
            type: TransactionType.expense,
            amount: total,
            currency: account.currency,
            txnDate: date,
            description: description ?? merchantName ?? undefined,
            merchantName: merchantName ?? undefined,
          },
          {
            source: TransactionSource.ocr,
            within: (tx, created) => finish(tx, created.id, created.categoryId),
          },
        );
      }
    } catch (error) {
      await this.storage.delete(attachmentKey);
      throw error;
    }

    return this.findById(id, userId);
  }

  /** Marks the draft discarded and deletes the photo. */
  async discard(id: string, userId: string): Promise<boolean> {
    const receipt = await this.getOwned(id, userId);
    if (receipt.status === ReceiptStatus.discarded) return true;
    if (receipt.status === ReceiptStatus.confirmed) {
      throw new ConflictError('A confirmed receipt cannot be discarded');
    }
    if (
      receipt.status === ReceiptStatus.processing ||
      receipt.status === ReceiptStatus.uploaded
    ) {
      throw new ConflictError('Wait until the receipt finishes processing');
    }
    await this.prisma.receiptImport.update({
      where: { id },
      data: {
        status: ReceiptStatus.discarded,
        matchedTransactionId: null,
        ocrText: null,
        rawExtraction: Prisma.DbNull,
      },
    });
    await this.storage.delete(receipt.fileKey);
    return true;
  }

  /** The user's movement a receipt photo can be attached to. */
  private async attachTarget(
    transactionId: string,
    userId: string,
    receiptId: string,
  ) {
    const target = await this.prisma.transaction.findFirst({
      where: { id: transactionId, userId },
      select: {
        id: true,
        categoryId: true,
        receiptImport: { select: { id: true } },
        _count: { select: { attachments: true } },
      },
    });
    if (!target) throw new NotFoundError('Transaction not found');
    if (target.receiptImport && target.receiptImport.id !== receiptId) {
      throw new ConflictError('This movement already has a receipt attached');
    }
    if (target._count.attachments >= MAX_ATTACHMENTS_PER_TRANSACTION) {
      throw new ValidationError(
        `A transaction can have at most ${MAX_ATTACHMENTS_PER_TRANSACTION} attachments`,
      );
    }
    return target;
  }

  private assertReviewable(receipt: PlainReceiptRow) {
    if (receipt.status === ReceiptStatus.confirmed) {
      throw new ConflictError('This receipt was already confirmed');
    }
    if (receipt.status === ReceiptStatus.discarded) {
      throw new ConflictError('This receipt was discarded');
    }
    if (!REVIEWABLE.includes(receipt.status)) {
      throw new ConflictError('Wait until the receipt finishes processing');
    }
  }

  private async getOwned(id: string, userId: string): Promise<PlainReceiptRow> {
    const receipt = await this.prisma.receiptImport.findFirst({
      where: { id, userId },
    });
    if (!receipt) throw new NotFoundError('Receipt not found');
    return receipt;
  }

  private async getAccount(accountId: string, userId: string) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId },
    });
    if (!account) throw new NotFoundError('Account not found');
    return account;
  }

  private map(row: ReceiptRow): ReceiptImport {
    const account = row.suggestedAccount;
    return {
      id: row.id,
      status: row.status,
      fileName: row.fileName,
      route: row.route,
      confidence: row.confidence,
      total: row.total === null ? null : Number(row.total),
      currency: row.currency,
      date: row.date,
      merchantName: row.merchantName,
      merchantTaxId: row.merchantTaxId,
      cardLast4: row.cardLast4,
      suggestedAccount: account ? mapAccount(account) : null,
      suggestedCategory: row.suggestedCategory
        ? mapCategory(row.suggestedCategory)
        : null,
      matchedTransaction: row.matchedTransaction
        ? mapTransaction(row.matchedTransaction)
        : null,
      transaction: row.transaction ? mapTransaction(row.transaction) : null,
      errorMessage: row.errorMessage,
      createdAt: row.createdAt,
    };
  }
}

function mapAccount(
  account: Prisma.AccountGetPayload<Record<string, never>>,
): Account {
  return {
    id: account.id,
    userId: account.userId,
    type: account.type,
    name: account.name,
    currency: account.currency,
    balanceCurrent: Number(account.balanceCurrent),
    metadata: (account.metadata as AccountMetadata | null) ?? undefined,
    archived: account.archived,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

// No ValidationPipe runs the DTO decorators: inputs are checked here.

function validTotal(value: number): number {
  if (!Number.isFinite(value) || value <= 0 || value >= 100_000_000) {
    throw new ValidationError('The total must be a positive amount');
  }
  return roundMoney(value);
}

function validDate(value: Date | string): Date {
  try {
    return toLocalDateOnly(value);
  } catch {
    throw new ValidationError('Invalid date');
  }
}

function cleanText(
  value: string | null | undefined,
  max: number,
  field: string,
): string | null {
  if (value === undefined || value === null) return null;
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length > max) {
    throw new ValidationError(`${field} is longer than ${max} characters`);
  }
  return text || null;
}
