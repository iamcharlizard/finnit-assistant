import { createHash, randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import {
  AccountType,
  ImportedLineKind,
  ImportedLineStatus,
  OccurrenceMatchSource,
  Prisma,
  ReceiptRoute,
  ReceiptStatus,
  TransactionSource,
} from '@finnit/database';
import { PrismaService } from '../../services/prisma.service';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../common/exceptions/graphql-error.exception';
import { localToday } from '../../common/utils/local-date.util';
import { AccountMetadata } from '../../common/types/models/account-metadata.model';
import { Account } from '../../common/types/models/account.model';
import { AiModelsService, NoUsableAiModelError } from '../ai/ai-models.service';
import { AiProviderError } from '../ai/providers/ai-provider';
import { OcrClient, OcrError, OcrRejectedError } from '../ocr/ocr.client';
import {
  MAX_RECEIPT_BYTES,
  OCR_REJECTED_MESSAGE,
  OCR_UNAVAILABLE_MESSAGE,
  RECEIPT_MIME_TYPES,
  type UploadedReceiptFile,
} from '../receipts/receipts.service';
import { normalizeText } from '../statements/parsing/parse-utils';
import { DEBIT_KINDS } from '../statements/parsing/parsed-statement';
import { LineMaterializerService } from '../statements/reconciliation/line-materializer.service';
import { ReconciliationService } from '../statements/reconciliation/reconciliation.service';
import {
  S3StorageService,
  type StoredObject,
} from '../storage/s3-storage.service';
import { detectFileType, safeFileName } from '../storage/file-type.util';
import {
  MAX_SHOT_MERCHANT_LENGTH,
  ScreenshotImport,
  ScreenshotLine,
  UpdateScreenshotLineInput,
} from './dto/screenshot.dto';
import { extractScreenshotWithAi } from './screenshot-ai';
import {
  extractScreenshot,
  type ShotExtraction,
  type ShotMovement,
  type ShotReviewField,
} from './screenshot-rules';
import { visibleCategoryWhere } from '../categories/category-scope';

const PROCESS_FAILED_MESSAGE = 'No se pudo procesar la captura';
const NO_MOVEMENTS_MESSAGE = 'No encontramos movimientos en la captura';

/** What a line keeps in `raw`: what to check, and its place in the screenshot. */
interface LineRaw {
  review: ShotReviewField[];
  index: number;
}

const LINE_INCLUDE = {
  matchedTransaction: {
    select: {
      id: true,
      txnDate: true,
      amount: true,
      merchantName: true,
      description: true,
      aliasName: true,
    },
  },
} satisfies Prisma.ImportedTransactionInclude;

const IMPORT_INCLUDE = {
  account: true,
  lines: { include: LINE_INCLUDE, orderBy: { importedAt: 'asc' } },
} satisfies Prisma.ScreenshotImportInclude;

type ImportRow = Prisma.ScreenshotImportGetPayload<{
  include: typeof IMPORT_INCLUDE;
}>;
type LineRow = Prisma.ImportedTransactionGetPayload<{
  include: typeof LINE_INCLUDE;
}>;
type PlainImportRow = Prisma.ScreenshotImportGetPayload<Record<string, never>>;

const REVIEWABLE: ReceiptStatus[] = [
  ReceiptStatus.needs_review,
  ReceiptStatus.failed,
];

const dateOnly = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/**
 * Screenshots of a bank app's movement list: upload → OCR → local rules →
 * (AI fallback, text only) → lines for the detected account, matched against
 * what is already registered → the user reviews them → confirm creates the
 * movements (or discard).
 */
@Injectable()
export class ScreenshotsService {
  private readonly logger = new Logger(ScreenshotsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: S3StorageService,
    private readonly ocr: OcrClient,
    private readonly aiModels: AiModelsService,
    private readonly reconciliation: ReconciliationService,
    private readonly materializer: LineMaterializerService,
  ) {}

  /**
   * Stores the screenshot and reads it in the background. The same file
   * again returns the existing import (a failed one is retried; a discarded
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
        'Only JPEG, PNG, WEBP or HEIC images are allowed',
      );
    }

    const fileHash = createHash('sha256').update(file.buffer).digest('hex');
    const existing = await this.prisma.screenshotImport.findUnique({
      where: { userId_fileHash: { userId, fileHash } },
    });
    if (existing?.status === ReceiptStatus.failed) {
      this.processInBackground(existing.id);
      return { id: existing.id, status: ReceiptStatus.processing };
    }
    if (existing?.status === ReceiptStatus.discarded) {
      await this.prisma.screenshotImport.delete({ where: { id: existing.id } });
    } else if (existing) {
      return { id: existing.id, status: existing.status };
    }

    const id = randomUUID();
    const fileKey = S3StorageService.key(
      userId,
      'screenshots',
      id,
      type.extension,
    );
    await this.storage.put(fileKey, file.buffer, type.mime);
    try {
      await this.prisma.screenshotImport.create({
        data: {
          id,
          userId,
          fileKey,
          fileHash,
          fileName: safeFileName(
            file.originalname,
            `captura.${type.extension}`,
          ),
          mimeType: type.mime,
          fileSize: file.size,
        },
      });
    } catch (error) {
      await this.storage.delete(fileKey);
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const first = await this.prisma.screenshotImport.findUnique({
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
    // In-process (single API replica). The client polls `screenshotImport`.
    void this.process(id).catch((error: Error) =>
      this.logger.error(`Screenshot ${id} processing crashed`, error),
    );
  }

  /** OCR → rules → (AI) → account → lines. Never throws. */
  async process(id: string): Promise<void> {
    const shot = await this.prisma.screenshotImport.update({
      where: { id },
      data: { status: ReceiptStatus.processing, errorMessage: null },
    });
    try {
      if (!this.ocr.isConfigured) {
        await this.fail(id, OCR_UNAVAILABLE_MESSAGE);
        return;
      }
      const image = await this.storage.get(shot.fileKey);
      const ocr = await this.ocr.image(image, shot.mimeType);
      const today = localToday();

      let extraction = extractScreenshot({ lines: ocr.lines, today });
      let route: ReceiptRoute = ReceiptRoute.ocr_rules;
      let ai: { model: string } | undefined;
      // The AI only when the rules found nothing or most needs checking.
      if (needsAi(extraction) && ocr.lines.length > 0) {
        const result = await this.tryAi(id, ocr.lines, today);
        if (result && result.extraction.movements.length > 0) {
          extraction = {
            accountHint:
              extraction.accountHint ?? result.extraction.accountHint,
            last4: extraction.last4 ?? result.extraction.last4,
            movements: result.extraction.movements,
          };
          route = ReceiptRoute.ai;
          ai = { model: result.model };
        }
      }
      if (extraction.movements.length === 0) {
        await this.fail(id, NO_MOVEMENTS_MESSAGE);
        return;
      }

      const accountId = extraction.last4
        ? await this.accountForDigits(shot.userId, extraction.last4)
        : null;
      await this.prisma.screenshotImport.update({
        where: { id },
        data: {
          status: ReceiptStatus.needs_review,
          route,
          accountHint: extraction.accountHint?.slice(0, 120) ?? null,
          last4: extraction.last4,
          accountId,
          ocrText: ocr.lines.map((line) => line.text).join('\n'),
          rawExtraction: {
            movements: extraction.movements,
            ocr: {
              width: ocr.width,
              height: ocr.height,
              lines: ocr.lines.length,
              timingsMs: ocr.timingsMs ?? null,
            },
            ...(ai && { ai }),
          } as unknown as Prisma.InputJsonValue,
        },
      });
      if (accountId) await this.buildLines(id, accountId);
    } catch (error) {
      const message =
        error instanceof OcrRejectedError
          ? OCR_REJECTED_MESSAGE
          : error instanceof OcrError
            ? OCR_UNAVAILABLE_MESSAGE
            : PROCESS_FAILED_MESSAGE;
      this.logger.warn(
        `Screenshot ${id} failed: ${(error as Error).message ?? message}`,
      );
      await this.fail(id, message);
    }
  }

  private async fail(id: string, message: string) {
    await this.prisma.screenshotImport.update({
      where: { id },
      data: { status: ReceiptStatus.failed, errorMessage: message },
    });
  }

  private async tryAi(
    id: string,
    lines: Parameters<typeof extractScreenshotWithAi>[1],
    today: Date,
  ) {
    try {
      return await extractScreenshotWithAi(this.aiModels, lines, today);
    } catch (error) {
      if (
        error instanceof NoUsableAiModelError ||
        error instanceof AiProviderError
      ) {
        this.logger.debug(
          `Screenshot ${id}: no AI fallback (${error.message})`,
        );
        return undefined;
      }
      throw error;
    }
  }

  /**
   * The user's active account the screenshot's digits ("**482") belong to:
   * the bank's mask, the card's last digits or the name ends with them.
   */
  async accountForDigits(
    userId: string,
    digits: string,
  ): Promise<string | null> {
    const accounts = await this.prisma.account.findMany({
      where: { userId, archived: false },
      select: {
        id: true,
        name: true,
        metadata: true,
        linkedAccounts: { select: { mask: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    const match = accounts.find((account) => {
      const last4 = (account.metadata as AccountMetadata | null)?.last4;
      return (
        account.linkedAccounts.some((l) => l.mask?.endsWith(digits)) ||
        Boolean(last4?.endsWith(digits)) ||
        new RegExp(`[*•·]{2,}\\s?\\d*${digits}\\b`).test(account.name)
      );
    });
    return match?.id ?? null;
  }

  /**
   * (Re)creates the lines of the screenshot for its account and matches them
   * with what is already registered there (any source), so nothing is
   * created twice; categories come from rules and recurring payments.
   */
  private async buildLines(id: string, accountId: string) {
    const shot = await this.prisma.screenshotImport.findUniqueOrThrow({
      where: { id },
    });
    const account = await this.prisma.account.findUniqueOrThrow({
      where: { id: accountId },
      select: { currency: true, type: true },
    });
    const movements =
      (shot.rawExtraction as { movements?: ShotMovement[] } | null)
        ?.movements ?? [];
    const today = localToday().toISOString().slice(0, 10);
    const isCredit = account.type === AccountType.credit;

    await this.prisma.importedTransaction.deleteMany({
      where: { screenshotImportId: id },
    });
    const base = Date.now();
    await this.prisma.importedTransaction.createMany({
      data: movements.map((movement, index) => ({
        accountId,
        screenshotImportId: id,
        kind:
          movement.direction === 'in'
            ? isCredit
              ? ImportedLineKind.payment
              : ImportedLineKind.deposit
            : ImportedLineKind.charge,
        amount: movement.amount ?? 0,
        currency: account.currency,
        // A missing date starts as today, flagged for review.
        date: dateOnly(movement.date ?? today),
        description: movement.merchant,
        merchant: movement.merchant,
        inProcess: movement.inProcess,
        raw: { review: movement.review, index } satisfies LineRaw,
        // Keeps the screenshot's order (lines are listed by this).
        importedAt: new Date(base + index),
      })),
    });
    const rows = await this.prisma.importedTransaction.findMany({
      where: { screenshotImportId: id, amount: { gt: 0 } },
    });
    await this.reconciliation.reconcileLines(
      shot.userId,
      accountId,
      rows,
      'screenshot',
    );
  }

  async findById(id: string, userId: string): Promise<ScreenshotImport> {
    const row = await this.prisma.screenshotImport.findFirst({
      where: { id, userId },
      include: IMPORT_INCLUDE,
    });
    if (!row) throw new NotFoundError('Screenshot not found');
    return this.map(row);
  }

  /** Chooses the account the screenshot is about: its lines start over. */
  async setAccount(
    id: string,
    userId: string,
    accountId: string,
  ): Promise<ScreenshotImport> {
    const shot = await this.getOwned(id, userId);
    this.assertReviewable(shot);
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId, archived: false },
      select: { id: true },
    });
    if (!account) throw new NotFoundError('Account not found');
    await this.prisma.screenshotImport.update({
      where: { id },
      data: { accountId },
    });
    await this.buildLines(id, accountId);
    return this.findById(id, userId);
  }

  /** Corrects a line; changing what identifies it matches it again. */
  async updateLine(
    lineId: string,
    userId: string,
    input: UpdateScreenshotLineInput,
  ): Promise<ScreenshotImport> {
    const line = await this.prisma.importedTransaction.findFirst({
      where: { id: lineId, screenshotImport: { userId } },
      include: { screenshotImport: true, account: true },
    });
    if (!line?.screenshotImport) throw new NotFoundError('Line not found');
    this.assertReviewable(line.screenshotImport);

    const raw = (line.raw ?? { review: [], index: 0 }) as unknown as LineRaw;
    const checked = new Set(raw.review);
    const data: Prisma.ImportedTransactionUpdateInput = {};
    if (input.date !== undefined) {
      const day = input.date.toISOString().slice(0, 10);
      if (day > localToday().toISOString().slice(0, 10)) {
        throw new ValidationError('The date cannot be in the future');
      }
      data.date = dateOnly(day);
      checked.delete('date');
    }
    if (input.merchant !== undefined) {
      const merchant =
        input.merchant.trim().slice(0, MAX_SHOT_MERCHANT_LENGTH) || null;
      data.merchant = merchant;
      data.description = merchant;
      checked.delete('merchant');
    }
    if (input.amount !== undefined) {
      data.amount = input.amount;
      checked.delete('amount');
    }
    if (input.direction !== undefined) {
      data.kind =
        input.direction === 'in'
          ? line.account.type === AccountType.credit
            ? ImportedLineKind.payment
            : ImportedLineKind.deposit
          : ImportedLineKind.charge;
    }
    if (input.inProcess !== undefined) data.inProcess = input.inProcess;
    if (input.categoryId !== undefined) {
      data.suggestedCategoryId = input.categoryId
        ? await this.ownCategory(userId, input.categoryId)
        : null;
    }
    if (input.include === false) {
      data.status = ImportedLineStatus.ignored;
    } else if (input.include === true) {
      // "Not a duplicate": create it even if it looked registered.
      data.status = ImportedLineStatus.pending;
      data.matchedTransaction = { disconnect: true };
    }
    data.raw = { ...raw, review: [...checked] };

    const updated = await this.prisma.importedTransaction.update({
      where: { id: lineId },
      data,
    });
    const rematch =
      input.include === undefined &&
      updated.status !== ImportedLineStatus.ignored &&
      Number(updated.amount) > 0 &&
      (input.date !== undefined ||
        input.amount !== undefined ||
        input.direction !== undefined);
    if (rematch) {
      await this.reconciliation.reconcileLines(
        userId,
        updated.accountId,
        [updated],
        'screenshot',
      );
    }
    return this.findById(line.screenshotImport.id, userId);
  }

  /**
   * Creates the movements of the lines still included (the ones already
   * registered are linked, not created). Every line needs an amount; a
   * movement already created from another screenshot is never made twice.
   */
  async confirm(id: string, userId: string): Promise<ScreenshotImport> {
    const shot = await this.getOwned(id, userId);
    this.assertReviewable(shot);
    if (!shot.accountId) {
      throw new ValidationError('Choose the account of the screenshot');
    }
    const accountId = shot.accountId;
    const lines = await this.prisma.importedTransaction.findMany({
      where: { screenshotImportId: id },
      orderBy: { importedAt: 'asc' },
    });
    const included = lines.filter(
      (line) => line.status !== ImportedLineStatus.ignored,
    );
    if (included.some((line) => !(Number(line.amount) > 0))) {
      throw new ValidationError('Every movement needs its amount');
    }
    if (!included.some((line) => line.status === ImportedLineStatus.pending)) {
      if (!included.length) {
        throw new ValidationError('Choose at least one movement');
      }
    }

    // A stable id per line: the same row of another screenshot (same day,
    // amount and merchant, and its order among equal rows) is the same one.
    const seen = new Map<string, number>();
    const externalIds = new Map<string, string>();
    for (const line of included) {
      const key = [
        'screenshot',
        accountId,
        line.date.toISOString().slice(0, 10),
        Number(line.amount).toFixed(2),
        DEBIT_KINDS.has(line.kind) ? 'out' : 'in',
        normalizeText(line.merchant ?? '').slice(0, 40),
      ].join(':');
      const n = (seen.get(key) ?? 0) + 1;
      seen.set(key, n);
      externalIds.set(line.id, `${key}:${n}`);
    }
    const taken = await this.prisma.transaction.findMany({
      where: { externalId: { in: [...externalIds.values()] } },
      select: { id: true, externalId: true },
    });
    const takenBy = new Map(taken.map((t) => [t.externalId, t.id]));

    await this.prisma.$transaction(
      async (tx) => {
        for (const line of included) {
          const externalId = externalIds.get(line.id);
          const existing = externalId ? takenBy.get(externalId) : undefined;
          if (line.status === ImportedLineStatus.pending && existing) {
            await tx.importedTransaction.update({
              where: { id: line.id },
              data: {
                status: ImportedLineStatus.matched,
                matchedTransactionId: existing,
              },
            });
          }
        }
        const fresh = await tx.importedTransaction.findMany({
          where: {
            screenshotImportId: id,
            status: { not: ImportedLineStatus.ignored },
          },
        });
        await this.materializer.materialize(tx, fresh, {
          userId,
          accountId,
          source: TransactionSource.ocr,
          matchedBy: OccurrenceMatchSource.manual,
          adjustBalance: true,
          externalId: (line) => externalIds.get(line.id),
        });
        await tx.screenshotImport.update({
          where: { id },
          data: { status: ReceiptStatus.confirmed },
        });
      },
      { timeout: 60_000 },
    );
    return this.findById(id, userId);
  }

  /** Discards the screenshot: its lines and the image go. */
  async discard(id: string, userId: string): Promise<boolean> {
    const shot = await this.getOwned(id, userId);
    if (shot.status === ReceiptStatus.discarded) return true;
    if (shot.status === ReceiptStatus.confirmed) {
      throw new ConflictError('A confirmed screenshot cannot be discarded');
    }
    if (
      shot.status === ReceiptStatus.processing ||
      shot.status === ReceiptStatus.uploaded
    ) {
      throw new ConflictError('Wait until the screenshot finishes processing');
    }
    await this.prisma.$transaction([
      this.prisma.importedTransaction.deleteMany({
        where: { screenshotImportId: id },
      }),
      this.prisma.screenshotImport.update({
        where: { id },
        data: {
          status: ReceiptStatus.discarded,
          ocrText: null,
          rawExtraction: Prisma.DbNull,
        },
      }),
    ]);
    await this.storage.delete(shot.fileKey);
    return true;
  }

  async openFile(
    id: string,
    userId: string,
  ): Promise<{ file: StoredObject; fileName: string; mimeType: string }> {
    const shot = await this.getOwned(id, userId);
    if (shot.status === ReceiptStatus.discarded) {
      throw new NotFoundError('Screenshot not found');
    }
    return {
      file: await this.storage.open(shot.fileKey),
      fileName: shot.fileName ?? 'captura',
      mimeType: shot.mimeType,
    };
  }

  private async ownCategory(userId: string, categoryId: string) {
    const category = await this.prisma.category.findFirst({
      where: {
        id: categoryId,
        ...visibleCategoryWhere(userId),
      },
      select: { id: true },
    });
    if (!category) throw new NotFoundError('Category not found');
    return category.id;
  }

  private assertReviewable(shot: PlainImportRow) {
    if (shot.status === ReceiptStatus.confirmed) {
      throw new ConflictError('This screenshot was already saved');
    }
    if (shot.status === ReceiptStatus.discarded) {
      throw new ConflictError('This screenshot was discarded');
    }
    if (!REVIEWABLE.includes(shot.status)) {
      throw new ConflictError('Wait until the screenshot finishes processing');
    }
  }

  private async getOwned(id: string, userId: string): Promise<PlainImportRow> {
    const shot = await this.prisma.screenshotImport.findFirst({
      where: { id, userId },
    });
    if (!shot) throw new NotFoundError('Screenshot not found');
    return shot;
  }

  private map(row: ImportRow): ScreenshotImport {
    const movements =
      (row.rawExtraction as { movements?: unknown[] } | null)?.movements ?? [];
    return {
      id: row.id,
      status: row.status,
      route: row.route,
      accountHint: row.accountHint,
      last4: row.last4,
      account: row.account ? mapAccount(row.account) : null,
      lines: row.lines.map((line) => this.mapLine(line)),
      movementsRead: movements.length,
      errorMessage: row.errorMessage,
      createdAt: row.createdAt,
    };
  }

  private mapLine(line: LineRow): ScreenshotLine {
    const raw = (line.raw ?? { review: [] }) as unknown as LineRaw;
    const match = line.matchedTransaction;
    return {
      id: line.id,
      date: line.date,
      merchant: line.merchant ?? undefined,
      amount: Number(line.amount),
      direction: DEBIT_KINDS.has(line.kind) ? 'out' : 'in',
      inProcess: line.inProcess,
      review: raw.review ?? [],
      status: line.status,
      categoryId: line.suggestedCategoryId,
      matchedTransaction: match
        ? {
            id: match.id,
            date: match.txnDate,
            amount: Number(match.amount),
            name:
              match.aliasName ??
              match.merchantName ??
              match.description ??
              undefined,
          }
        : null,
    };
  }
}

/** Rules found nothing, or most of what they found needs checking. */
export function needsAi(extraction: ShotExtraction): boolean {
  const { movements } = extraction;
  if (movements.length === 0) return true;
  const unsure = movements.filter((m) => m.review.length > 0).length;
  return unsure / movements.length > 0.5;
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
    isDefaultCash: account.isDefaultCash ?? false,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}
