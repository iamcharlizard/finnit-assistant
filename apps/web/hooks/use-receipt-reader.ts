'use client';

import { gql } from '@/lib/graphql/client';
import {
  RECEIPT_IMPORT_QUERY,
  type ReceiptImport,
} from '@/lib/receipts/graphql';
import { uploadReceipt } from '@/lib/receipts/upload';
import { useImportReader } from './use-import-reader';

async function fetchReceipt(id: string): Promise<ReceiptImport> {
  const { receiptImport } = await gql<{ receiptImport: ReceiptImport }>(
    RECEIPT_IMPORT_QUERY,
    { id },
  );
  return receiptImport;
}

/**
 * Uploads a receipt photo and follows the import until it's read (see
 * lib/receipts/reader.ts). `onReady` gets the import once it's read and
 * waiting for review.
 */
export function useReceiptReader(onReady: (receipt: ReceiptImport) => void) {
  return useImportReader<ReceiptImport>({
    upload: uploadReceipt,
    fetchImport: fetchReceipt,
    onReady,
  });
}
