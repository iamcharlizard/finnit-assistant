import { Prisma } from '@finnit/database';
import { AccountMetadata } from '../../common/types/models/account-metadata.model';
import { Attachment } from '../../common/types/models/attachment.model';
import { Category } from '../../common/types/models/category.model';
import { Transaction } from '../../common/types/models/transaction.model';

/**
 * Shown for a private movement that has no display name of its own. The
 * Transaction.displayName field resolver translates it (PRIVATE_FALLBACK_NAMES).
 */
export const PRIVATE_FALLBACK_NAME = 'Movimiento privado';

export const PRIVATE_FALLBACK_NAMES: Record<string, string> = {
  es: PRIVATE_FALLBACK_NAME,
  en: 'Private movement',
};

/**
 * Relations every Transaction response loads: the alias rule (display name
 * and privacy) and the pending category suggestion.
 */
export const TRANSACTION_PRESENTATION_INCLUDE = {
  alias: {
    select: {
      id: true,
      displayName: true,
      isPrivate: true,
      pattern: true,
      isProtected: true,
    },
  },
  suggestedCategory: true,
} satisfies Prisma.TransactionInclude;

/** The alias rule fields a movement's presentation uses (id/pattern when loaded). */
export interface PresentationAlias {
  id?: string;
  displayName: string;
  isPrivate: boolean;
  pattern?: string;
  /** Needs the privacy PIN to show the bank text or the pattern. */
  isProtected?: boolean;
}

type TransactionRow = Prisma.TransactionGetPayload<Record<string, never>> & {
  alias?: PresentationAlias | null;
  suggestedCategory?: Prisma.CategoryGetPayload<Record<string, never>> | null;
  account?: Prisma.AccountGetPayload<Record<string, never>> | null;
  category?: Prisma.CategoryGetPayload<Record<string, never>> | null;
  attachments?: Prisma.AttachmentGetPayload<Record<string, never>>[];
};

export interface PresentationInput {
  merchantName: string | null;
  description: string | null;
  notes?: string | null;
  aliasName: string | null;
  isPrivate: boolean;
  alias?: PresentationAlias | null;
}

export interface Presentation {
  displayName: string;
  isPrivate: boolean;
  /** The movement's own privacy flag (a rule may also make it private). */
  ownPrivate: boolean;
  /** Its bank text needs the privacy PIN (protected rule, not unlocked). */
  originalLocked: boolean;
  /** The rule that names it; its pattern only when revealed (it may say what the movement is). */
  aliasRule: {
    id: string;
    displayName: string;
    isPrivate: boolean;
    isProtected: boolean;
    pattern: string | null;
  } | null;
  hasOwnAlias: boolean;
  originalDescription: string | null;
  merchantName: string | null;
  description: string | null;
  notes: string | null;
}

/**
 * Display name and privacy of a movement (feature 17). The original text is
 * hidden for private movements unless `reveal` (the detail query, "ver
 * original").
 */
export function presentTransaction(
  row: PresentationInput,
  revealRequested = false,
  unlocked = false,
): Presentation {
  const ownName = row.aliasName?.trim() || null;
  // A protected rule (privacy PIN) is always private and only reveals when unlocked.
  const isProtected = Boolean(row.alias?.isProtected);
  const isPrivate =
    row.isPrivate || Boolean(row.alias?.isPrivate) || isProtected;
  const reveal = revealRequested && (!isProtected || unlocked);
  const original = row.merchantName?.trim() || row.description?.trim() || null;
  const hide = isPrivate && !reveal;
  const displayName =
    ownName ??
    row.alias?.displayName ??
    (isPrivate ? PRIVATE_FALLBACK_NAME : (original ?? ''));
  return {
    displayName,
    isPrivate,
    originalLocked: isProtected && !reveal,
    ownPrivate: Boolean(row.isPrivate),
    aliasRule: row.alias?.id
      ? {
          id: row.alias.id,
          displayName: row.alias.displayName,
          isPrivate: row.alias.isPrivate || isProtected,
          isProtected,
          pattern: reveal || !isPrivate ? (row.alias.pattern ?? null) : null,
        }
      : null,
    hasOwnAlias: ownName !== null,
    originalDescription: hide ? null : original,
    merchantName: hide ? null : row.merchantName,
    description: hide ? null : row.description,
    // Notes may say what a private movement is: hidden like the bank text.
    notes: hide ? null : (row.notes ?? null),
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
    alias?: PresentationAlias | null;
  },
  reveal = false,
): Pick<
  Transaction,
  | 'displayName'
  | 'isPrivate'
  | 'ownPrivate'
  | 'originalLocked'
  | 'aliasRule'
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
    ownPrivate: shown.ownPrivate,
    originalLocked: shown.originalLocked,
    aliasRule: shown.aliasRule,
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
    kind: category.kind,
    icon: category.icon,
    color: category.color,
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
  options: { reveal?: boolean; unlocked?: boolean } = {},
): Transaction {
  const shown = presentTransaction(
    transaction,
    options.reveal,
    options.unlocked,
  );
  return {
    id: transaction.id,
    userId: transaction.userId,
    accountId: transaction.accountId,
    categoryId: transaction.categoryId || undefined,
    type: transaction.type,
    amount: Number(transaction.amount),
    balanceEffect:
      transaction.balanceEffect === null ||
      transaction.balanceEffect === undefined
        ? null
        : Number(transaction.balanceEffect),
    currency: transaction.currency,
    txnDate: transaction.txnDate,
    description: shown.description || undefined,
    merchantName: shown.merchantName || undefined,
    notes: shown.notes,
    isPending: transaction.isPending,
    inProcess: transaction.inProcess ?? false,
    isRecurringInstance: transaction.isRecurringInstance,
    source: transaction.source,
    externalId: transaction.externalId || undefined,
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt,
    displayName: shown.displayName,
    isPrivate: shown.isPrivate,
    ownPrivate: shown.ownPrivate,
    originalLocked: shown.originalLocked,
    aliasRule: shown.aliasRule,
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
        isDefaultCash: transaction.account.isDefaultCash ?? false,
        includeInTotal: transaction.account.includeInTotal ?? true,
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
