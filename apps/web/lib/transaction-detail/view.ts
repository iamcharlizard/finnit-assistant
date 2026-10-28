import type { Localizer } from '@/lib/i18n/translator';
import { accountLabel } from '@/lib/finance/accounts';
import { categoryLabel } from '@/lib/finance/categories';
import { dayKeyOf, longDate, timeOf, type DayKey } from '@/lib/finance/dates';
import { formatMoney } from '@/lib/finance/money';
import { direction, transactionTitle } from '@/lib/finance/transactions';
import type { ApiAttachment, TransactionDetail } from './types';

/** Where a movement came from, as the detail names it. */
export type SourceKind = 'manual' | 'bank' | 'statement' | 'receipt' | 'sms';

export function sourceKind(source: string): SourceKind {
  switch (source) {
    case 'imported':
      return 'bank';
    case 'statement':
      return 'statement';
    case 'ocr':
      return 'receipt';
    case 'sms':
      return 'sms';
    default:
      return 'manual';
  }
}

/**
 * What the edit form may change. The API only edits movements created by
 * hand; from bank or statement ones only the category (their name changes
 * with an alias). A transfer keeps its amount and date (both sides must
 * agree) and adjustments their amount (the API can't tell their direction).
 */
export interface EditRules {
  amount: boolean;
  date: boolean;
  merchant: boolean;
  description: boolean;
  category: boolean;
}

export function editRules(
  tx: Pick<TransactionDetail, 'source' | 'type'>,
): EditRules {
  const categorizable = tx.type === 'income' || tx.type === 'expense';
  if (tx.source !== 'manual') {
    return {
      amount: false,
      date: false,
      merchant: false,
      description: false,
      category: categorizable,
    };
  }
  return {
    amount: categorizable,
    date: tx.type !== 'transfer',
    merchant: true,
    description: true,
    category: categorizable,
  };
}

export const canEditAnything = (rules: EditRules) =>
  Object.values(rules).some(Boolean);

/** Why the movement can't be deleted here, or null when it can. */
export type DeleteBlock = 'imported' | 'transfer' | null;

export function deleteBlock(
  tx: Pick<TransactionDetail, 'source' | 'type'>,
): DeleteBlock {
  if (tx.source !== 'manual') return 'imported';
  if (tx.type === 'transfer') return 'transfer';
  return null;
}

export interface AttachmentView {
  id: string;
  name: string;
  /** "PDF · 1.2 MB" */
  meta: string;
  /** Download through this site's file proxy; null for legacy links. */
  href: string | null;
}

export function attachmentDownloadHref(id: string): string {
  return `/api/files/attachments/${encodeURIComponent(id)}/file`;
}

/** "1.2 MB", "820 KB", "12 B" (same text on server and browser). */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`;
}

function fileKind(fileType: string): string {
  if (fileType === 'application/pdf') return 'PDF';
  const image = /^image\/(.+)$/.exec(fileType);
  if (image) return image[1]!.toUpperCase().replace('JPEG', 'JPG');
  return fileType;
}

export function toAttachmentView(
  attachment: ApiAttachment,
  fallbackName: string,
): AttachmentView {
  return {
    id: attachment.id,
    name: attachment.fileName?.trim() || fallbackName,
    meta: [
      fileKind(attachment.fileType),
      attachment.fileSize ? formatFileSize(attachment.fileSize) : null,
    ]
      .filter(Boolean)
      .join(' · '),
    href: attachment.downloadPath
      ? attachmentDownloadHref(attachment.id)
      : null,
  };
}

export interface TransactionDetailView {
  id: string;
  title: string;
  isPrivate: boolean;
  hasOwnAlias: boolean;
  /** The original text ("Ver original"); null when there's none to reveal. */
  original: string | null;
  /** Signed like the lists: "-$80.00", "+$1,200.00". */
  amount: string;
  variant: 'income' | 'expense' | 'neutral';
  typeLabel: string;
  day: DayKey;
  /** "14 de octubre de 2026 · 14:32" */
  dateLabel: string;
  accountLabel: string;
  categoryLabel: string | null;
  sourceKind: SourceKind;
  pending: boolean;
  /** The other side of a transfer, linked. */
  counterpart: { href: string; label: string } | null;
  /** The recurring payment it paid, linked. */
  recurring: { href: string; label: string } | null;
  attachments: AttachmentView[];
  rules: EditRules;
  deleteBlock: DeleteBlock;
}

export function toTransactionDetailView(
  tx: TransactionDetail,
  today: DayKey,
  { locale, t }: Localizer,
): TransactionDetailView {
  const dir = direction(tx);
  const day = dayKeyOf(tx.txnDate);
  // Far-away "today" so the year always shows.
  const date = longDate(day, `${Number(day.slice(0, 4)) + 1}-01-01`, locale);
  const time = timeOf(tx.txnDate);
  const original = tx.originalDescription?.trim() || null;
  const title = transactionTitle(tx, t);
  const counterpart = tx.transferCounterpart;
  const recurring = tx.recurringPayment;
  const recurringDay = recurring ? dayKeyOf(recurring.dueDate) : null;

  return {
    id: tx.id,
    title,
    isPrivate: tx.isPrivate,
    hasOwnAlias: Boolean(tx.hasOwnAlias),
    // A transfer's text is the API's own ("Transfer to …"), not the bank's.
    original:
      original && original !== title && (tx.isPrivate || tx.type !== 'transfer')
        ? original
        : null,
    amount: formatMoney(
      dir === 'out' ? -tx.amount : tx.amount,
      tx.currency,
      locale,
      {
        sign: dir === 'unknown' ? 'never' : 'always',
      },
    ),
    variant: dir === 'in' ? 'income' : dir === 'out' ? 'expense' : 'neutral',
    typeLabel: t(`transaction.types.${tx.type}`),
    day,
    dateLabel: time ? `${date} · ${time}` : date,
    accountLabel: tx.account ? accountLabel(tx.account) : '—',
    categoryLabel:
      tx.type === 'income' || tx.type === 'expense'
        ? categoryLabel(tx.category?.name, t)
        : null,
    sourceKind: sourceKind(tx.source),
    pending: tx.isPending,
    counterpart: counterpart
      ? {
          href: `/transactions/${counterpart.transactionId}`,
          label: t(
            counterpart.direction === 'out'
              ? 'transaction.counterpartTo'
              : 'transaction.counterpartFrom',
            { account: counterpart.accountName },
          ),
        }
      : null,
    recurring:
      recurring && recurringDay
        ? {
            href: `/recurring?date=${recurringDay}`,
            label: t('transaction.recurringPaid', {
              name: recurring.name,
              date: longDate(recurringDay, today, locale),
            }),
          }
        : null,
    attachments: (tx.attachments ?? []).map((a) =>
      toAttachmentView(a, t('transaction.attachments.unnamed')),
    ),
    rules: editRules(tx),
    deleteBlock: deleteBlock(tx),
  };
}
