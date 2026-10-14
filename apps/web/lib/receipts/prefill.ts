import { dayKeyOf, isDayKey, type DayKey } from '@/lib/finance/dates';
import { parseAmount, type EntryDraft } from '@/lib/new-entry/form';
import type {
  EntryAccount,
  EntryCategory,
  SimilarTransaction,
} from '@/lib/new-entry/graphql';
import type { ReceiptImport, ReceiptRoute } from './graphql';

/**
 * From a read receipt to the expense form and back: what it pre-fills, which
 * fields deserve a second look, and the confirmReceiptImport input.
 */

/** Fields of the expense form a receipt can fill. */
export type CheckField = 'amount' | 'date' | 'merchant' | 'accountId';

const CHECK_ORDER: readonly CheckField[] = [
  'amount',
  'date',
  'merchant',
  'accountId',
];

export interface ReceiptPrefill {
  draft: EntryDraft;
  /** Fields to highlight: not found on the receipt, or read with low confidence. */
  check: CheckField[];
}

/** The purchase day as 'YYYY-MM-DD' (date-only values keep their calendar day). */
export function receiptDayKey(date: string | null | undefined): DayKey | null {
  if (!date) return null;
  if (isDayKey(date)) return date;
  if (Number.isNaN(new Date(date).getTime())) return null;
  return dayKeyOf(date);
}

/** "123.40" for the amount field, or null when there is no usable total. */
export function amountText(total: number | null | undefined): string | null {
  if (typeof total !== 'number' || !Number.isFinite(total) || total <= 0) {
    return null;
  }
  return total.toFixed(2);
}

/**
 * The expense draft with what the receipt says. Values found on the receipt
 * replace the draft's; the rest of the draft (e.g. a note) is kept.
 */
export function prefillFromReceipt(
  draft: EntryDraft,
  receipt: ReceiptImport,
  accounts: ReadonlyArray<Pick<EntryAccount, 'id'>>,
  categories: ReadonlyArray<Pick<EntryCategory, 'id'>>,
  today: DayKey,
): ReceiptPrefill {
  const amount = amountText(receipt.total);
  const day = receiptDayKey(receipt.date);
  const date = day && day <= today ? day : null;
  const merchant = receipt.merchantName?.trim() || null;

  const suggestedAccount = receipt.suggestedAccount?.id;
  let accountId = draft.accountId;
  if (suggestedAccount && accounts.some((a) => a.id === suggestedAccount)) {
    accountId = suggestedAccount;
  } else if (!accountId && accounts.length === 1) {
    accountId = accounts[0]!.id;
  }

  const suggestedCategory = receipt.suggestedCategory?.id;
  const category =
    suggestedCategory && categories.some((c) => c.id === suggestedCategory)
      ? suggestedCategory
      : null;

  const next: EntryDraft = {
    ...draft,
    type: 'expense',
    amount: amount ?? draft.amount,
    date: date ?? draft.date,
    merchant: merchant ?? draft.merchant,
    accountId,
    // The receipt's category (merchant tax ID table) wins over the
    // merchant-history suggestion; the user can still change it.
    ...(category ? { categoryId: category, categoryPicked: true } : {}),
  };

  const check = new Set<CheckField>();
  if (!amount) check.add('amount');
  if (!date) check.add('date');
  if (!merchant) check.add('merchant');
  if (!accountId) check.add('accountId');
  if (receipt.confidence === 'low' || receipt.confidence === null) {
    if (amount) check.add('amount');
    if (date) check.add('date');
    if (merchant) check.add('merchant');
  }

  return { draft: next, check: CHECK_ORDER.filter((f) => check.has(f)) };
}

/** Key of the "how it was read" badge (under `receipts.source`). */
export function readSourceKey(
  route: ReceiptRoute | null | undefined,
): 'qr' | 'ocr' | 'ai' | null {
  switch (route) {
    case 'cfdi_qr':
      return 'qr';
    case 'ocr_rules':
      return 'ocr';
    case 'ai':
      return 'ai';
    default:
      return null;
  }
}

export interface ConfirmReceiptPayload {
  accountId: string;
  categoryId: string | null;
  total: number;
  /** Date-only 'YYYY-MM-DD': the API stores it as that calendar day. */
  date: DayKey;
  merchantName: string | null;
  description: string | null;
  /** Attach the photo to this existing movement instead of creating one. */
  attachToTransactionId?: string;
}

/** confirmReceiptImport's input for a valid draft (validate first). */
export function buildConfirmInput(
  draft: EntryDraft,
  attachToTransactionId?: string,
): ConfirmReceiptPayload {
  return {
    accountId: draft.accountId!,
    categoryId: draft.categoryId ?? null,
    total: parseAmount(draft.amount)!,
    date: draft.date!,
    merchantName: draft.merchant.trim() || null,
    description: draft.note.trim() || null,
    ...(attachToTransactionId ? { attachToTransactionId } : {}),
  };
}

/**
 * "¿Ya está registrado?" candidates: the match the server found when it read
 * the receipt, then look-alikes of what the form says now (without repeats).
 */
export function receiptMatches(
  receipt: Pick<ReceiptImport, 'matchedTransaction'>,
  similar: ReadonlyArray<SimilarTransaction> | null | undefined,
): SimilarTransaction[] {
  const out: SimilarTransaction[] = [];
  const seen = new Set<string>();
  for (const match of [receipt.matchedTransaction, ...(similar ?? [])]) {
    if (!match || seen.has(match.id)) continue;
    seen.add(match.id);
    out.push(match);
  }
  return out;
}

/** Receipts read and waiting for the user, newest first, at most `limit`. */
export function pendingReceipts(
  receipts: ReadonlyArray<ReceiptImport>,
  limit = 5,
): ReceiptImport[] {
  return receipts
    .filter((r) => r.status === 'needs_review')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}
