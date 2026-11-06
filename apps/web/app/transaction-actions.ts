'use server';

import { isUuid } from '@/lib/files/routes';
import {
  loadTransactionDetail,
  type TransactionDetailData,
} from '@/lib/transaction-detail/load';

export type DetailResult =
  | { ok: true; data: TransactionDetailData }
  | { ok: false; error: 'notFound' | 'failed' };

/**
 * The movement's detail for the drawer: the same data its page loads on
 * the server (one GraphQL request), as plain props.
 */
export async function loadTransactionDetailAction(
  id: string,
): Promise<DetailResult> {
  if (!isUuid(id)) return { ok: false, error: 'notFound' };
  try {
    return { ok: true, data: await loadTransactionDetail(id) };
  } catch (error) {
    // notFound() throws a special error; anything else is a failure.
    const digest = (error as { digest?: string } | null)?.digest ?? '';
    return {
      ok: false,
      error: digest.includes('NOT_FOUND') ? 'notFound' : 'failed',
    };
  }
}
