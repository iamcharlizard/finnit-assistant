import { Prisma, TransactionSource, TransactionType } from '@finnit/database';

import { NotFoundError } from '../../common/exceptions/graphql-error.exception';
import { effectOf } from '../../common/utils/balance-effect.util';
import { removeMovement } from '../../common/utils/remove-movement.util';

export const DISSOLVE_SIDE_SELECT = {
  id: true,
  accountId: true,
  type: true,
  amount: true,
  balanceEffect: true,
  isPending: true,
  createdAt: true,
  source: true,
  originalType: true,
  _count: { select: { importedMatches: true } },
} satisfies Prisma.TransactionSelect;

type Side = Prisma.TransactionGetPayload<{
  select: typeof DISSOLVE_SIDE_SELECT;
}>;

/**
 * Whether a side stays as an ordinary movement when its transfer is undone
 * or deleted: it was an expense/income before (converted), it came from the
 * bank, or the bank has since confirmed it. Otherwise it only existed for
 * the transfer and goes with it.
 */
export function keptWhenDissolved(
  side: Pick<Side, 'originalType' | 'source' | '_count'>,
): boolean {
  return (
    side.originalType !== null ||
    side.source !== TransactionSource.manual ||
    side._count.importedMatches > 0
  );
}

/**
 * Removes a transfer: sides that existed before (or the bank knows) get
 * their type back without touching balances; sides it created are deleted,
 * reverting their balance. Returns the transfer's sides.
 */
export async function dissolveTransfer(
  tx: Prisma.TransactionClient,
  transfer: { id: string; fromTxn: Side; toTxn: Side },
): Promise<Side[]> {
  await tx.transfer.delete({ where: { id: transfer.id } });
  const sides = [transfer.fromTxn, transfer.toTxn];
  for (const side of sides) {
    if (side.originalType) {
      await tx.transaction.update({
        where: { id: side.id },
        data: { type: side.originalType, originalType: null },
      });
    } else if (keptWhenDissolved(side)) {
      await tx.transaction.update({
        where: { id: side.id },
        data: {
          type:
            effectOf(side) > 0
              ? TransactionType.income
              : TransactionType.expense,
        },
      });
    } else {
      await removeMovement(tx, side);
    }
  }
  return sides;
}

/** The transfer a movement belongs to, with its sides, or null. */
export async function transferOfMovement(
  tx: Prisma.TransactionClient,
  where: Prisma.TransferWhereInput,
): Promise<{
  id: string;
  convertedAt: Date | null;
  fromTxn: Side;
  toTxn: Side;
} | null> {
  return tx.transfer.findFirst({
    where,
    select: {
      id: true,
      convertedAt: true,
      fromTxn: { select: DISSOLVE_SIDE_SELECT },
      toTxn: { select: DISSOLVE_SIDE_SELECT },
    },
  });
}

export function requireTransfer<T>(transfer: T | null): T {
  if (!transfer) throw new NotFoundError('Transfer not found');
  return transfer;
}

/** A movement becomes a transfer side: keeps its balance effect, drops its category. */
export async function becomeSide(
  tx: Prisma.TransactionClient,
  row: {
    id: string;
    type: TransactionType;
    amount: Prisma.Decimal | number;
    balanceEffect: Prisma.Decimal | number | null;
  },
): Promise<void> {
  await tx.transaction.update({
    where: { id: row.id },
    data: {
      type: TransactionType.transfer,
      originalType: row.type,
      balanceEffect: effectOf(row),
      categoryId: null,
      categorySource: null,
      suggestedCategoryId: null,
      suggestedBy: null,
    },
  });
}
