import { Prisma, TransactionType } from '@finnit/database';

type Client = Prisma.TransactionClient;

const toCents = (value: number) => Math.round(value * 100) / 100;

/**
 * What a movement of this type does to its account's balance when nothing
 * else says so: income adds, everything else takes. Transfers, deposits and
 * adjustments pass their own sign instead.
 */
export function defaultEffect(type: TransactionType, amount: number): number {
  const value = toCents(Math.abs(amount));
  return type === TransactionType.income ? value : -value;
}

/** The movement's signed effect: the stored one, or by its type (older rows). */
export function effectOf(movement: {
  type: TransactionType;
  amount: Prisma.Decimal | number;
  balanceEffect?: Prisma.Decimal | number | null;
}): number {
  return movement.balanceEffect !== null && movement.balanceEffect !== undefined
    ? Number(movement.balanceEffect)
    : defaultEffect(movement.type, Number(movement.amount));
}

/** What a movement adds to its account's balance now: nothing while pending. */
export function appliedEffect(
  effect: number,
  isPending: boolean | null | undefined,
): number {
  return isPending ? 0 : effect;
}

/** The same direction with a new amount (editing a movement's amount). */
export function withAmount(effect: number, amount: number): number {
  const value = toCents(Math.abs(amount));
  return effect < 0 ? -value : value;
}

/** Moves an account's balance by `change` (no write when it is 0). */
export async function moveBalance(
  tx: Client,
  accountId: string,
  change: number,
): Promise<void> {
  const value = toCents(change);
  if (value === 0) return;
  await tx.account.update({
    where: { id: accountId },
    data: { balanceCurrent: { increment: value } },
  });
}
