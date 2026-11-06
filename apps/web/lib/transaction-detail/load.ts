import 'server-only';

import { notFound } from 'next/navigation';

import { serverGraphql } from '@/lib/api/server-graphql';
import { todayKey, type DayKey } from '@finnit/core/finance/dates';
import { isUuid } from '@/lib/files/routes';
import { getLocalizer } from '@/lib/i18n/server';
import { detailFormOf, type DetailForm } from '@finnit/core/transaction-detail/form';
import {
  TRANSACTION_DETAIL_QUERY,
  type DetailCategory,
  type TransactionDetail,
} from '@finnit/core/transaction-detail/types';
import { toTransactionDetailView, type TransactionDetailView } from '@finnit/core/transaction-detail/view';

export interface TransactionDetailData {
  today: DayKey;
  view: TransactionDetailView;
  form: DetailForm;
  currency: string;
  /** Income or expense: which categories the picker lists first. */
  categoryKind: 'expense' | 'income';
  categories: DetailCategory[];
}

/** One movement for /transactions/[id]; unknown or someone else's → 404. */
export async function loadTransactionDetail(
  id: string,
): Promise<TransactionDetailData> {
  if (!isUuid(id)) notFound();
  const [data, l] = await Promise.all([
    serverGraphql<{
      transaction: TransactionDetail;
      categories: DetailCategory[];
    }>(TRANSACTION_DETAIL_QUERY, { id }).catch((error: unknown) => {
      if (error instanceof Error && /not found/i.test(error.message)) {
        notFound();
      }
      throw error;
    }),
    getLocalizer(),
  ]);
  const today = todayKey();
  const tx = data.transaction;
  return {
    today,
    view: toTransactionDetailView(tx, today, l),
    form: detailFormOf(tx),
    currency: tx.currency,
    categoryKind: tx.type === 'income' ? 'income' : 'expense',
    categories: data.categories,
  };
}
