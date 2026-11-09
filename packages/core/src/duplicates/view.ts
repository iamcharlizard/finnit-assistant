import { accountLabel } from '../finance/accounts';
import { categoryLabel } from '../finance/categories';
import { dayKeyOf, shortDate } from '../finance/dates';
import { formatMoney } from '../finance/money';
import { direction, transactionTitle } from '../finance/transactions';
import type { ApiTransaction } from '../finance/types';
import type { Localizer } from '../i18n/translator';
import type { MergeNameFrom } from './request';

/** One of the two movements, side by side in the merge dialog. */
export interface MergeSide {
  id: string;
  title: string;
  /** "8 nov" */
  date: string;
  /** Signed: "+$800.00" */
  amount: string;
  /** "Banco" or "Manual". */
  origin: string;
  fromBank: boolean;
  /** "Transferencia", "Supermercado" or "Sin categoría". */
  category: string;
  account: string;
}

export interface MergePlan {
  /** The one that stays (the bank's, when there is one). */
  keep: MergeSide;
  /** The one merging deletes. */
  drop: MergeSide;
  /** Both came from the bank: they can't be merged (delete one instead). */
  blocked: boolean;
  /** The names to choose from (one when both read the same). */
  names: { value: MergeNameFrom; label: string }[];
  /** The name chosen at first: the user's own over the bank's text. */
  defaultName: MergeNameFrom;
}

const isBank = (tx: Pick<ApiTransaction, 'source'>) => tx.source !== 'manual';

export function toMergeSide(
  tx: ApiTransaction,
  { locale, t }: Localizer,
): MergeSide {
  const dir = direction(tx);
  const signed = dir === 'out' ? -Math.abs(tx.amount) : Math.abs(tx.amount);
  return {
    id: tx.id,
    title: transactionTitle(tx, t),
    date: shortDate(dayKeyOf(tx.txnDate), locale),
    amount: formatMoney(signed, tx.currency, locale, {
      sign: dir === 'unknown' ? 'never' : 'always',
    }),
    origin: t(
      isBank(tx) ? 'duplicates.origin.bank' : 'duplicates.origin.manual',
    ),
    fromBank: isBank(tx),
    category:
      tx.type === 'transfer'
        ? t('finance.transfer')
        : categoryLabel(tx.category?.name, t),
    account: tx.account ? accountLabel(tx.account) : '',
  };
}

/**
 * Which one stays and which goes: the bank's stays (syncing keeps matching
 * it); between two by hand, the one the user is looking at.
 */
export function mergePlan(
  current: ApiTransaction,
  other: ApiTransaction,
  l: Localizer,
): MergePlan {
  const keepCurrent = isBank(current) || !isBank(other);
  const keep = toMergeSide(keepCurrent ? current : other, l);
  const drop = toMergeSide(keepCurrent ? other : current, l);
  const sameName =
    keep.title.trim().toLowerCase() === drop.title.trim().toLowerCase();
  return {
    keep,
    drop,
    blocked: keep.fromBank && drop.fromBank,
    names: sameName
      ? [{ value: 'keep', label: keep.title }]
      : [
          { value: 'drop', label: drop.title },
          { value: 'keep', label: keep.title },
        ],
    defaultName: !sameName && keep.fromBank && !drop.fromBank ? 'drop' : 'keep',
  };
}
