import { ImportedLineStatus, Prisma, TransactionType } from '@finnit/database';

import { appliedEffect, effectOf, moveBalance } from './balance-effect.util';

type Client = Prisma.TransactionClient;

/** What removeMovement needs to know about the movement. */
export interface RemovableMovement {
  id: string;
  accountId: string;
  type: TransactionType;
  amount: Prisma.Decimal | number;
  balanceEffect: Prisma.Decimal | number | null;
  isPending: boolean;
  createdAt: Date;
}

/**
 * Deletes a movement and everything that only pointed at it, keeping the
 * books straight:
 * - its account's balance loses its effect;
 * - a bank line it came from (or was linked to) is ignored, so the next
 *   sync or statement never brings it back;
 * - a loan payment it paid stays as a payment without a movement;
 * - an account linked to a bank keeps reconciling: if the bank already
 *   counted it at the last sync, the reconciled balance drops too, so the
 *   next sync shows the bank's money as "Diferencia con el banco" instead of
 *   silently putting it back.
 * Transfers must be dissolved first (Transfer rows restrict the delete).
 */
export async function removeMovement(
  tx: Client,
  movement: RemovableMovement,
): Promise<void> {
  const applied = appliedEffect(effectOf(movement), movement.isPending);
  await moveBalance(tx, movement.accountId, -applied);

  if (applied !== 0) {
    const linked = await tx.linkedAccount.findFirst({
      where: {
        accountId: movement.accountId,
        reconciledAt: { gte: movement.createdAt },
        reconciledBalance: { not: null },
      },
      select: { id: true },
    });
    if (linked) {
      await tx.linkedAccount.update({
        where: { id: linked.id },
        data: { reconciledBalance: { decrement: applied } },
      });
    }
  }

  await tx.importedTransaction.updateMany({
    where: { matchedTransactionId: movement.id },
    data: { status: ImportedLineStatus.ignored, matchedTransactionId: null },
  });
  await tx.debtPayment.updateMany({
    where: { transactionId: movement.id },
    data: { transactionId: null },
  });
  await tx.transaction.delete({ where: { id: movement.id } });
}
