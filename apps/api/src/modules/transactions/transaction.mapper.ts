import { Prisma } from '@finnit/database';
import { AccountMetadata } from '../../common/types/models/account-metadata.model';
import { Attachment } from '../../common/types/models/attachment.model';
import { Category } from '../../common/types/models/category.model';
import { Transaction } from '../../common/types/models/transaction.model';

/** Shown for a private movement that has no display name of its own. */
export const PRIVATE_FALLBACK_NAME = 'Movimiento privado';

/**
 * Relations every Transaction response loads: the alias rule (display name
 * and privacy) and the pending category suggestion.
 */
export const TRANSACTION_PRESENTATION_INCLUDE = {
  alias: { select: { displayName: true, isPrivate: true } },
  suggestedCategory: true,
} satisfies Prisma.TransactionInclude;

type TransactionRow = Prisma.TransactionGetPayload<Record<string, never>> & {
  alias?: { displayName: string; isPrivate: boolean } | null;
  suggestedCategory?: Prisma.CategoryGetPayload<Record<string, never>> | null;
  account?: Prisma.AccountGetPayload<Record<string, never>> | null;
  category?: Prisma.CategoryGetPayload<Record<string, never>> | null;
  attachments?: Prisma.AttachmentGetPayload<Record<string, never>>[];
};

export interface PresentationInput {
  merchantName: string | null;
  description: string | null;
  aliasName: string | null;
  isPrivate: boolean;
  alias?: { displayName: string; isPrivate: boolean } | null;
}

export interface Presentation {
  displayName: string;
  isPrivate: boolean;
  hasOwnAlias: boolean;
  originalDescription: string | null;
  merchantName: string | null;
  description: string | null;
}

/**
 * Display name and privacy of a movement (feature 17). The original text is
 * hidden for private movements unless `reveal` (the detail query, "ver
 * original").
 */
export function presentTransaction(
  row: PresentationInput,
  reveal = false,
): Presentation {
  const ownName = row.aliasName?.trim() || null;
  const isPrivate = row.isPrivate || Boolean(row.alias?.isPrivate);
  const original = row.merchantName?.trim() || row.description?.trim() || null;
  const hide = isPrivate && !reveal;
  const displayName =
    ownName ??
    row.alias?.displayName ??
    (isPrivate ? PRIVATE_FALLBACK_NAME : (original ?? ''));
  return {
    displayName,
    isPrivate,
    hasOwnAlias: ownName !== null,
    originalDescription: hide ? null : original,
    merchantName: hide ? null : row.merchantName,
    description: hide ? null : row.description,
  };
}

/**
 * The alias/categorization fields of the Transaction type for rows mapped
 * elsewhere (e.g. transfers). Accepts rows that did not load the relations.
 */
export function presentationFields(
  row: {
    merchantName?: string | null;
    description?: string | null;
    aliasId?: string | null;
    aliasName?: string | null;
    isPrivate?: boolean | null;
    categorySource?: Transaction['categorySource'];
    alias?: { displayName: string; isPrivate: boolean } | null;
  },
  reveal = false,
): Pick<
  Transaction,
  | 'displayName'
  | 'isPrivate'
  | 'originalDescription'
  | 'aliasId'
  | 'hasOwnAlias'
  | 'categorySource'
  | 'description'
  | 'merchantName'
> {
  const shown = presentTransaction(
    {
      merchantName: row.merchantName ?? null,
      description: row.description ?? null,
      aliasName: row.aliasName ?? null,
      isPrivate: Boolean(row.isPrivate),
      alias: row.alias,
    },
    reveal,
  );
  return {
    displayName: shown.displayName,
    isPrivate: shown.isPrivate,
    originalDescription: shown.originalDescription,
    aliasId: row.aliasId ?? null,
    hasOwnAlias: shown.hasOwnAlias,
    categorySource: row.categorySource ?? null,
    description: shown.description ?? undefined,
    merchantName: shown.merchantName ?? undefined,
  };
}

export function mapCategory(
  category: Prisma.CategoryGetPayload<Record<string, never>>,
): Category {
  return {
    id: category.id,
    userId: category.userId || undefined,
    parentId: category.parentId || undefined,
    name: category.name,
    isDefault: category.isDefault,
    sortOrder: category.sortOrder || undefined,
    createdAt: category.createdAt,
  };
}

export function mapAttachment(
  attachment: Prisma.AttachmentGetPayload<Record<string, never>>,
): Attachment {
  return {
    id: attachment.id,
    transactionId: attachment.transactionId,
    fileName: attachment.fileName ?? undefined,
    fileType: attachment.fileType,
    fileSize: attachment.fileSize ?? undefined,
    downloadPath: attachment.fileKey
      ? `/attachments/${attachment.id}/file`
      : undefined,
    uploadedAt: attachment.uploadedAt,
  };
}

/** A transaction row (with whatever relations it loaded) as the GraphQL type. */
export function mapTransaction(
  transaction: TransactionRow,
  options: { reveal?: boolean } = {},
): Transaction {
  const shown = presentTransaction(transaction, options.reveal);
  return {
    id: transaction.id,
    userId: transaction.userId,
    accountId: transaction.accountId,
    categoryId: transaction.categoryId || undefined,
    type: transaction.type,
    amount: Number(transaction.amount),
    currency: transaction.currency,
    txnDate: transaction.txnDate,
    description: shown.description || undefined,
    merchantName: shown.merchantName || undefined,
    isPending: transaction.isPending,
    isRecurringInstance: transaction.isRecurringInstance,
    source: transaction.source,
    externalId: transaction.externalId || undefined,
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt,
    displayName: shown.displayName,
    isPrivate: shown.isPrivate,
    originalDescription: shown.originalDescription,
    aliasId: transaction.aliasId ?? null,
    hasOwnAlias: shown.hasOwnAlias,
    categorySource: transaction.categorySource ?? null,
    suggestedCategory: transaction.suggestedCategory
      ? mapCategory(transaction.suggestedCategory)
      : null,
    ...(transaction.account && {
      account: {
        id: transaction.account.id,
        userId: transaction.account.userId,
        type: transaction.account.type,
        name: transaction.account.name,
        currency: transaction.account.currency,
        balanceCurrent: Number(transaction.account.balanceCurrent),
        metadata: transaction.account.metadata as AccountMetadata,
        archived: transaction.account.archived,
        createdAt: transaction.account.createdAt,
        updatedAt: transaction.account.updatedAt,
      },
    }),
    ...(transaction.category && {
      category: mapCategory(transaction.category),
    }),
    ...(transaction.attachments && {
      attachments: transaction.attachments.map(mapAttachment),
    }),
  };
}
