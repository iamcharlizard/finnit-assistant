import { nameSubjectOf, type NameSubject } from '../categorize/rename';
import type { Localizer } from '../i18n/translator';
import { accountLabel } from '../finance/accounts';
import { categoryLabel } from '../finance/categories';
import { dayKeyOf, longDate, timeOf, type DayKey } from '../finance/dates';
import { formatMoney } from '../finance/money';
import { direction, transactionTitle } from '../finance/transactions';
import { canConvertToTransfer, type ConvertSource } from '../transfers/convert';
import { debtHref } from '../debts/view';
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
 * hand; bank or statement ones keep the bank's data and only take a
 * category. A transfer keeps its amount and date (both sides must agree)
 * and adjustments their amount (the API can't tell their direction).
 * Notes, the name and privacy are the user's on every movement.
 */
export interface EditRules {
  amount: boolean;
  date: boolean;
  merchant: boolean;
  description: boolean;
  category: boolean;
  notes: boolean;
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
      notes: true,
    };
  }
  return {
    amount: categorizable,
    date: tx.type !== 'transfer',
    merchant: true,
    description: true,
    category: categorizable,
    notes: true,
  };
}

/** Why the movement can't be deleted here, or null when it can. */
export type DeleteBlock = 'adjustment' | null;

export function deleteBlock(tx: Pick<TransactionDetail, 'type'>): DeleteBlock {
  // The balance is fixed again instead (older ones have no direction).
  if (tx.type === 'adjustment') return 'adjustment';
  return null;
}

/**
 * What else happens when the movement is deleted, for the confirmation: a
 * bank one isn't imported again; a transfer goes whole (the other side is
 * deleted, or stays as an expense/income when it came from the bank); a
 * loan payment stays without a movement.
 */
export function deleteNotes(
  tx: Pick<TransactionDetail, 'source' | 'transferCounterpart' | 'loanPayment'>,
  t: Localizer['t'],
): string[] {
  const notes: string[] = [];
  const counterpart = tx.transferCounterpart;
  if (counterpart) {
    notes.push(
      t(
        counterpart.keptOnDelete
          ? 'transaction.deleteNotes.transferKeeps'
          : 'transaction.deleteNotes.transferBoth',
        { account: counterpart.accountName },
      ),
    );
  }
  if (tx.source !== 'manual') notes.push(t('transaction.deleteNotes.bank'));
  if (tx.loanPayment) {
    notes.push(
      t('transaction.deleteNotes.loanPayment', {
        name: tx.loanPayment.debtName,
      }),
    );
  }
  return notes;
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
  /** The bank text is behind the privacy PIN ("Ver original" asks for it). */
  originalLocked: boolean;
  /** What the editor's name section starts from. */
  name: NameSubject;
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
  /** "En proceso": counted, the bank hasn't applied it yet. */
  inProcess: boolean;
  /** The user's notes ("" when none; hidden with the bank text when private). */
  notes: string;
  /** The other side of a transfer (opens its detail). */
  counterpart: {
    transactionId: string;
    label: string;
    transferId: string;
    /** Made from an expense/income: "Deshacer transferencia". */
    converted: boolean;
  } | null;
  /** An expense/income that can become a transfer; null otherwise. */
  convertSource: ConvertSource | null;
  /** The recurring payment it paid, linked (its scheduled payment to unlink). */
  recurring: { href: string; label: string; occurrenceId: string } | null;
  /**
   * The loan payment it is: the loan's page, and the scheduled payment to
   * unlink (null when the loan has no schedule: nothing to unlink).
   */
  loan: {
    href: string;
    label: string;
    occurrenceId: string | null;
  } | null;
  /** An expense that pays nothing yet: it can be linked to a loan payment. */
  canLinkLoan: boolean;
  /** The same: it can be linked to a recurring payment (subscription…). */
  canLinkRecurring: boolean;
  attachments: AttachmentView[];
  rules: EditRules;
  deleteBlock: DeleteBlock;
  /** What else deleting does (shown in the confirmation). */
  deleteNotes: string[];
  /** It may be a copy of another movement: "Marcar como duplicado". */
  mergeable: boolean;
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
  const loan = tx.loanPayment ?? null;
  const loanDay = loan?.dueDate ? dayKeyOf(loan.dueDate) : null;

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
    originalLocked: Boolean(tx.originalLocked),
    name: nameSubjectOf(tx),
    amount: formatMoney(
      dir === 'out' ? -Math.abs(tx.amount) : Math.abs(tx.amount),
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
    inProcess: Boolean(tx.inProcess),
    notes: tx.notes?.trim() ?? '',
    counterpart: counterpart
      ? {
          transferId: counterpart.transferId,
          converted: Boolean(counterpart.converted),
          transactionId: counterpart.transactionId,
          label: t(
            counterpart.direction === 'out'
              ? 'transaction.counterpartTo'
              : 'transaction.counterpartFrom',
            { account: counterpart.accountName },
          ),
        }
      : null,
    // A loan's scheduled payment is shown as the loan payment instead.
    recurring:
      recurring && recurringDay && !loan
        ? {
            href: `/recurring?date=${recurringDay}`,
            occurrenceId: recurring.occurrenceId,
            label: t('transaction.recurringPaid', {
              name: recurring.name,
              date: longDate(recurringDay, today, locale),
            }),
          }
        : null,
    loan: loan
      ? {
          href: debtHref({ id: loan.debtId, kind: 'loan' }),
          label: loanDay
            ? t('transaction.loanPaid', {
                name: loan.debtName,
                date: longDate(loanDay, today, locale),
              })
            : t('transaction.loanPaidUnscheduled', { name: loan.debtName }),
          occurrenceId: loan.occurrenceId,
        }
      : null,
    canLinkLoan: tx.type === 'expense' && !tx.isPending && !loan && !recurring,
    canLinkRecurring:
      tx.type === 'expense' && !tx.isPending && !loan && !recurring,
    attachments: (tx.attachments ?? []).map((a) =>
      toAttachmentView(a, t('transaction.attachments.unnamed')),
    ),
    convertSource:
      canConvertToTransfer(tx) && !counterpart
        ? {
            id: tx.id,
            type: tx.type,
            accountId: tx.accountId,
            currency: tx.currency,
            amount: Math.abs(tx.amount),
          }
        : null,
    rules: editRules(tx),
    deleteBlock: deleteBlock(tx),
    deleteNotes: deleteNotes(tx, t),
    mergeable: tx.type !== 'adjustment',
  };
}
