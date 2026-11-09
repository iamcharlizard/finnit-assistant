/**
 * One movement's detail, shared by the web (server loader) and the mobile
 * app: the query result turned into the screen's data.
 */
import type { DayKey } from '../finance/dates';
import type { Localizer } from '../i18n/translator';
import { detailFormOf, type DetailForm } from './form';
import type { DetailCategory, TransactionDetail } from './types';
import { toTransactionDetailView, type TransactionDetailView } from './view';

export { TRANSACTION_DETAIL_QUERY } from './types';

export interface TransactionDetailResult {
  transaction: TransactionDetail;
  categories: DetailCategory[];
}

export interface TransactionDetailData {
  today: DayKey;
  /** The movement as the API returned it (e.g. for "Marcar como duplicado"). */
  transaction: TransactionDetail;
  view: TransactionDetailView;
  form: DetailForm;
  currency: string;
  /** Income or expense: which categories the picker lists first. */
  categoryKind: 'expense' | 'income';
  categories: DetailCategory[];
}

export function buildTransactionDetailData(
  data: TransactionDetailResult,
  today: DayKey,
  l: Localizer,
): TransactionDetailData {
  const tx = data.transaction;
  return {
    today,
    transaction: tx,
    view: toTransactionDetailView(tx, today, l),
    form: detailFormOf(tx),
    currency: tx.currency,
    categoryKind: tx.type === 'income' ? 'income' : 'expense',
    categories: data.categories,
  };
}
