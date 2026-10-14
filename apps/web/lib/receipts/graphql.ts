import type { SimilarTransaction } from '@/lib/new-entry/graphql';

/**
 * GraphQL for receipt capture ("Capturar ticket" in the new-entry flow).
 * Sent from the browser through /api/graphql (lib/graphql/client.ts).
 */
export type ReceiptStatus =
  | 'uploaded'
  | 'processing'
  | 'needs_review'
  | 'confirmed'
  | 'discarded'
  | 'failed';

/** How the receipt was read: the CFDI QR, OCR + rules, or the AI fallback. */
export type ReceiptRoute = 'cfdi_qr' | 'ocr_rules' | 'ai';
export type ReceiptConfidence = 'high' | 'medium' | 'low';

export interface ReceiptImport {
  id: string;
  status: ReceiptStatus;
  fileName: string | null;
  route: ReceiptRoute | null;
  confidence: ReceiptConfidence | null;
  total: number | null;
  currency: string;
  /** Purchase date (API DateTime; usually a date-only midnight UTC). */
  date: string | null;
  merchantName: string | null;
  merchantTaxId: string | null;
  cardLast4: string | null;
  suggestedAccount: { id: string } | null;
  suggestedCategory: { id: string } | null;
  /** A movement that already looks like this purchase (same account, amount, ±3 days). */
  matchedTransaction: SimilarTransaction | null;
  transaction: { id: string } | null;
  errorMessage: string | null;
  createdAt: string;
}

const MATCH_FIELDS =
  'id type amount currency txnDate description merchantName displayName';

export const RECEIPT_FIELDS = `id status fileName route confidence total currency date merchantName merchantTaxId cardLast4 suggestedAccount { id } suggestedCategory { id } matchedTransaction { ${MATCH_FIELDS} } transaction { id } errorMessage createdAt`;

export const RECEIPT_IMPORT_QUERY = `query ReceiptImport($id: ID!) {
  receiptImport(id: $id) { ${RECEIPT_FIELDS} }
}`;

export const RECEIPT_STATUS_QUERY = `query ReceiptImportStatus($id: ID!) {
  receiptImport(id: $id) { id status }
}`;

export const RECEIPT_IMPORTS_QUERY = `query ReceiptImports($first: Int) {
  receiptImports(first: $first) { edges { node { ${RECEIPT_FIELDS} } } }
}`;

export interface ReceiptImportsData {
  receiptImports: { edges: { node: ReceiptImport }[] };
}

export const CONFIRM_RECEIPT_MUTATION = `mutation ConfirmReceiptImport($id: ID!, $input: ConfirmReceiptImportInput!) {
  confirmReceiptImport(id: $id, input: $input) { id status transaction { id } }
}`;

export const DISCARD_RECEIPT_MUTATION = `mutation DiscardReceiptImport($id: ID!) {
  discardReceiptImport(id: $id)
}`;
