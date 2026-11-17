import { Prisma, TransactionType } from '@finnit/database';

import {
  appliedEffect,
  effectOf,
  moveBalance,
  notCounted,
} from './balance-effect.util';

type Client = Prisma.TransactionClient;

/** What turning a movement around needs to know about it. */
export const DIRECTION_SELECT = {
  id: true,
  accountId: true,
  type: true,
  amount: true,
  balanceEffect: true,
  isPending: true,
  cancelledAt: true,
  categoryId: true,
  transferFrom: { select: { id: true } },
  transferTo: { select: { id: true } },
  debtPayment: { select: { id: true } },
  debtCharge: { select: { id: true } },
  debtDisbursement: { select: { id: true } },
  debtPurchase: { select: { id: true } },
  bankDifferenceOf: { select: { id: true } },
  recurringPayment: { select: { id: true } },
} satisfies Prisma.TransactionSelect;

export type DirectionMovement = Prisma.TransactionGetPayload<{
  select: typeof DIRECTION_SELECT;
}>;

/**
 * Why a movement can't be turned into income or expense: only a plain
 * expense or income can (not a transfer side, a loan's movement, a balance
 * adjustment, a scheduled payment it paid or a cancelled one). Null: it can.
 */
export type DirectionBlock =
  | 'type'
  | 'transfer'
  | 'loan'
  | 'recurring'
  | 'cancelled'
  | null;

export function directionBlockOf(movement: DirectionMovement): DirectionBlock {
  if (
    movement.type !== TransactionType.expense &&
    movement.type !== TransactionType.income
  ) {
    return 'type';
  }
  if (movement.bankDifferenceOf) return 'type';
  if (movement.transferFrom || movement.transferTo) return 'transfer';
  if (
    movement.debtPayment ||
    movement.debtCharge ||
    movement.debtDisbursement ||
    movement.debtPurchase
  ) {
    return 'loan';
  }
  if (movement.recurringPayment) return 'recurring';
  if (movement.cancelledAt) return 'cancelled';
  return null;
}

/**
 * Records an expense as income or the other way round ("Es un ingreso"):
 * the type and the sign of its effect change, and its account's balance
 * moves by twice the amount. Its category goes when it was of the other
 * kind (an income category on an expense). Returns how much the balance
 * moved. Call directionBlockOf first; `to` equal to its type does nothing.
 *
 * The bank's reconciled balance is left alone: the bank's balance already
 * has the movement the way it really went, so if the bank sent the wrong
 * sign the next sync agrees with the new direction.
 */
export async function turnMovement(
  tx: Client,
  movement: DirectionMovement,
  to: TransactionType,
  { categoryKind }: { categoryKind?: 'expense' | 'income' | null } = {},
): Promise<number> {
  if (movement.type === to) return 0;
  const before = effectOf(movement);
  const after = -before;
  const change = appliedEffect(after - before, notCounted(movement));
  await moveBalance(tx, movement.accountId, change);
  const dropCategory =
    movement.categoryId !== null &&
    Boolean(categoryKind) &&
    categoryKind !== to;
  await tx.transaction.update({
    where: { id: movement.id },
    data: {
      type: to,
      balanceEffect: after,
      ...(dropCategory && { categoryId: null, categorySource: null }),
    },
  });
  return change;
}

/** The type a movement goes to: income ↔ expense. */
export const oppositeOf = (type: TransactionType): TransactionType =>
  type === TransactionType.income
    ? TransactionType.expense
    : TransactionType.income;
