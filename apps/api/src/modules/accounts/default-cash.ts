import { AccountType, Prisma } from '@finnit/database';

type Db = Pick<Prisma.TransactionClient, 'account'>;

/** Name of the cash account every user has, in their language. */
export function defaultCashName(locale: string | null | undefined): string {
  return locale === 'en' ? 'Cash' : 'Efectivo';
}

/**
 * Makes sure the user has their cash account: marks their oldest open cash
 * account, or creates "Efectivo". Safe to call again.
 */
export async function ensureDefaultCashAccount(
  db: Db,
  userId: string,
  locale?: string | null,
): Promise<void> {
  const existing = await db.account.findFirst({
    where: { userId, isDefaultCash: true },
    select: { id: true },
  });
  if (existing) return;

  const cash = await db.account.findFirst({
    where: { userId, type: AccountType.cash, archived: false },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true },
  });
  try {
    if (cash) {
      await db.account.update({
        where: { id: cash.id },
        data: { isDefaultCash: true },
      });
      return;
    }
    const base = defaultCashName(locale);
    const taken = await db.account.findFirst({
      where: { userId, name: base },
      select: { id: true },
    });
    await db.account.create({
      data: {
        userId,
        type: AccountType.cash,
        name: taken ? `${base} 2` : base,
        currency: 'MXN',
        balanceCurrent: 0,
        isDefaultCash: true,
      },
    });
  } catch (error) {
    // Two sign-ins at once: the other one created it.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return;
    }
    throw error;
  }
}
