import {
  UNCATEGORIZED_LABEL,
  categoryIconKey,
  categoryLabel,
  type CategoryIndex,
  type IconKey,
} from './categories';
import { dayHeading, dayKeyOf, shortDate, timeOf, type DayKey } from './dates';
import { formatMoney } from './money';
import type { ApiTransaction } from './types';

/** A transaction row, ready to render (plain data, safe to send to the client). */
export interface TransactionRow {
  id: string;
  title: string;
  /** "Supermercado" */
  category: string;
  /** Account, plus the day when the row is shown outside a day group and
   * the time when the API has one: "BBVA Débito · 12 oct". */
  time: string;
  /** Signed: "-$80.00", "+$1,200.00"; adjustments have no sign. */
  amount: string;
  variant: 'income' | 'expense' | 'neutral';
  status: 'completed' | 'pending';
  iconKey: IconKey;
  day: DayKey;
}

export interface TransactionGroup {
  day: DayKey;
  heading: string;
  rows: TransactionRow[];
}

/**
 * Money in or out of the account. Transfers are two "transfer" rows (the
 * API marks the outgoing one in its description); adjustments (card
 * payments, refunds, balance fixes) don't say which way they went.
 */
export function direction(tx: ApiTransaction): 'in' | 'out' | 'unknown' {
  if (tx.type === 'income') return 'in';
  if (tx.type === 'expense') return 'out';
  if (tx.type === 'transfer') {
    if (/\(outgoing\)$/i.test(tx.description ?? '')) return 'out';
    if (/\(incoming\)$/i.test(tx.description ?? '')) return 'in';
  }
  return 'unknown';
}

// The API marks each side of a transfer in its description.
const TRANSFER_SIDE = / \((?:outgoing|incoming)\)$/i;

function title(tx: ApiTransaction): string {
  const text = (tx.merchantName || tx.description || '')
    .replace(TRANSFER_SIDE, '')
    .trim();
  if (tx.type === 'transfer') {
    const to = /^Transfer to (.+?)(?: \((?:outgoing|incoming)\))?$/i.exec(
      tx.description ?? '',
    );
    if (to) return `Transferencia a ${to[1]}`;
  }
  if (/^Initial balance$/i.test(text)) return 'Saldo inicial';
  if (text) return text;
  return tx.type === 'income'
    ? 'Ingreso'
    : tx.type === 'expense'
      ? 'Gasto'
      : 'Movimiento';
}

function categoryText(tx: ApiTransaction): string {
  if (tx.type === 'transfer') return 'Transferencia';
  if (tx.type === 'adjustment') return 'Ajuste o pago';
  return tx.category ? categoryLabel(tx.category.name) : UNCATEGORIZED_LABEL;
}

export function toTransactionRow(
  tx: ApiTransaction,
  categories: CategoryIndex,
  { withDate = false }: { withDate?: boolean } = {},
): TransactionRow {
  const day = dayKeyOf(tx.txnDate);
  const time = timeOf(tx.txnDate);
  const dir = direction(tx);
  const sign = dir === 'unknown' ? 'never' : 'always';
  const signed = dir === 'out' ? -tx.amount : tx.amount;

  return {
    id: tx.id,
    title: title(tx),
    category: categoryText(tx),
    time: [tx.account?.name, withDate ? shortDate(day) : null, time]
      .filter(Boolean)
      .join(' · '),
    amount: formatMoney(signed, tx.currency, { sign }),
    variant: dir === 'in' ? 'income' : dir === 'out' ? 'expense' : 'neutral',
    status: tx.isPending ? 'pending' : 'completed',
    iconKey:
      tx.type === 'transfer'
        ? 'transfer'
        : tx.type === 'adjustment'
          ? 'card'
          : tx.type === 'income' && !tx.category
            ? 'income'
            : categoryIconKey(categories, tx.category?.id),
    day,
  };
}

/** Rows grouped by day, newest first (the API's order is kept inside a day). */
export function groupByDay(
  rows: ReadonlyArray<TransactionRow>,
  today: DayKey,
): TransactionGroup[] {
  const groups = new Map<DayKey, TransactionRow[]>();
  for (const row of rows) {
    const group = groups.get(row.day);
    if (group) group.push(row);
    else groups.set(row.day, [row]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([day, dayRows]) => ({
      day,
      heading: dayHeading(day, today),
      rows: dayRows,
    }));
}
