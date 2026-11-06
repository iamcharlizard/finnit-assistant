import 'server-only';

import { notFound } from 'next/navigation';

import { serverGraphql } from '@/lib/api/server-graphql';
import { todayKey } from '@finnit/core/finance/dates';
import { isUuid } from '@/lib/files/routes';
import { getLocalizer } from '@/lib/i18n/server';
import {
  TRANSACTION_DETAIL_QUERY,
  buildTransactionDetailData,
  type TransactionDetailData,
  type TransactionDetailResult,
} from '@finnit/core/transaction-detail/request';

export type { TransactionDetailData };

/** One movement for /transactions/[id]; unknown or someone else's → 404. */
export async function loadTransactionDetail(
  id: string,
): Promise<TransactionDetailData> {
  if (!isUuid(id)) notFound();
  const [data, l] = await Promise.all([
    serverGraphql<TransactionDetailResult>(TRANSACTION_DETAIL_QUERY, { id }).catch(
      (error: unknown) => {
        if (error instanceof Error && /not found/i.test(error.message)) {
          notFound();
        }
        throw error;
      },
    ),
    getLocalizer(),
  ]);
  return buildTransactionDetailData(data, todayKey(), l);
}
