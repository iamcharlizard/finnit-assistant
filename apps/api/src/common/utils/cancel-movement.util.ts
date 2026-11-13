import { OccurrenceStatus, Prisma } from '@finnit/database';

import {
  appliedEffect,
  effectOf,
  moveBalance,
  notCounted,
} from './balance-effect.util';
import { followReconciledBalance } from './remove-movement.util';

type Client = Prisma.TransactionClient;

/** What cancelling or restoring needs to know about the movement. */
export const CANCELLABLE_SELECT = {
  id: true,
  accountId: true,
  type: true,
  amount: true,
  balanceEffect: true,
  isPending: true,
  cancelledAt: true,
  createdAt: true,
  transferFrom: { select: { id: true } },
  transferTo: { select: { id: true } },
  debtPayment: { select: { id: true } },
  debtCharge: { select: { id: true } },
  debtDisbursement: { select: { id: true } },
  bankDifferenceOf: { select: { id: true } },
  debtPurchase: { select: { id: true } },
  recurringPayment: {
    select: {
      id: true,
      recurringExpense: { select: { debtId: true, kind: true } },
    },
  },
} satisfies Prisma.TransactionSelect;

export type CancellableMovement = Prisma.TransactionGetPayload<{
  select: typeof CANCELLABLE_SELECT;
}>;

/**
 * Why a movement can't be marked cancelled: it is one side of a transfer,
 * part of a loan (a payment, its money or a card purchase in installments)
 * or a balance adjustment; or it already is. Null: it can.
 */
export type CancelBlock =
  | 'cancelled'
  | 'transfer'
  | 'loan'
  | 'adjustment'
  | null;

export function cancelBlockOf(movement: CancellableMovement): CancelBlock {
  if (movement.cancelledAt) return 'cancelled';
  if (movement.transferFrom || movement.transferTo) return 'transfer';
  if (movement.type === 'adjustment' || movement.bankDifferenceOf) {
    return 'adjustment';
  }
  if (
    movement.debtPayment ||
    movement.debtCharge ||
    movement.debtDisbursement ||
    movement.debtPurchase ||
    movement.recurringPayment?.recurringExpense.debtId
  ) {
    return 'loan';
  }
  return null;
}

/**
 * Marks a movement cancelled ("Cancelado"): it stays in the history but
 * stops counting. Its effect leaves the account's balance (and the
 * reconciled balance when the bank had counted it), a recurring payment it
 * paid opens again, and it is no longer "en proceso". Call cancelBlockOf
 * first.
 */
export async function cancelMovement(
  tx: Client,
  movement: CancellableMovement,
  at: Date = new Date(),
): Promise<void> {
  const applied = appliedEffect(effectOf(movement), notCounted(movement));
  await moveBalance(tx, movement.accountId, -applied);
  await followReconciledBalance(tx, movement, applied);
  if (movement.recurringPayment) {
    await tx.recurringOccurrence.update({
      where: { id: movement.recurringPayment.id },
      data: {
        status: OccurrenceStatus.upcoming,
        paidAt: null,
        matchedBy: null,
        transactionId: null,
      },
    });
  }
  await tx.transaction.update({
    where: { id: movement.id },
    data: { cancelledAt: at, inProcess: false },
  });
}

/** Undoes cancelMovement ("Reactivar"): it counts again. */
export async function restoreMovement(
  tx: Client,
  movement: CancellableMovement,
): Promise<void> {
  if (!movement.cancelledAt) return;
  const applied = appliedEffect(effectOf(movement), movement.isPending);
  await moveBalance(tx, movement.accountId, applied);
  await followReconciledBalance(tx, movement, -applied);
  await tx.transaction.update({
    where: { id: movement.id },
    data: { cancelledAt: null },
  });
}
