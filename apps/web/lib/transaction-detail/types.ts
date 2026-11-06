import {
  TRANSACTION_FIELDS,
  type ApiTransaction,
  type CategorySource,
} from '@/lib/finance/types';

/** A file attached to the movement (receipt, invoice…). */
export interface ApiAttachment {
  id: string;
  fileName: string | null;
  fileType: string;
  fileSize: number | null;
  /** Null for legacy external links: those can't be downloaded here. */
  downloadPath: string | null;
  uploadedAt: string;
}

/** A movement as its detail screen reads it (transaction(id)). */
export interface TransactionDetail extends ApiTransaction {
  /** The bank's/user's text; transaction(id) returns it even for private ones (not behind a locked PIN). */
  originalDescription: string | null;
  /** The bank text is behind the privacy PIN (protected automatic name). */
  originalLocked?: boolean;
  categorySource: CategorySource | null;
  attachments: ApiAttachment[] | null;
  transferCounterpart: {
    transferId: string;
    /** Made from an expense/income: it can be undone. */
    converted: boolean;
    transactionId: string;
    accountId: string;
    accountName: string;
    direction: 'in' | 'out';
  } | null;
  recurringPayment: {
    occurrenceId: string;
    recurringExpenseId: string;
    name: string;
    dueDate: string;
  } | null;
}

export const TRANSACTION_DETAIL_FIELDS = `${TRANSACTION_FIELDS} originalDescription originalLocked categorySource attachments { id fileName fileType fileSize downloadPath uploadedAt } transferCounterpart { transferId converted transactionId accountId accountName direction } recurringPayment { occurrenceId recurringExpenseId name dueDate }`;

/** A category for the edit form's picker (key orders the income group). */
export interface DetailCategory {
  id: string;
  name: string;
  parentId: string | null;
  key: string | null;
}

export const TRANSACTION_DETAIL_QUERY = `query TransactionDetail($id: String!) {
  transaction(id: $id) { ${TRANSACTION_DETAIL_FIELDS} }
  categories { id name parentId key kind icon }
}`;
