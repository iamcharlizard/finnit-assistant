import {
  DebtStatus,
  LoanType,
  OccurrenceStatus,
  Prisma,
  TransactionSource,
  TransactionType,
} from '@finnit/database';
import { addDays, toDateOnly } from '../recurring-expenses/schedule.util';
import { debtBalance, FinancedCharge } from './loan-math';

type Client = Prisma.TransactionClient;

type DebtWithLedger = Prisma.DebtGetPayload<{
  include: { payments: true; charges: true };
}>;

/** Balance of a debt loaded with its payments and charges. */
export function balanceOf(debt: DebtWithLedger): number {
  return debtBalance({
    principal: Number(debt.principal),
    totalToRepay: debt.totalToRepay === null ? null : Number(debt.totalToRepay),
    charges: debt.charges.map((c) => ({
      totalToRepay: Number(c.totalToRepay),
    })),
    payments: debt.payments.map((p) => ({ amount: Number(p.amount) })),
  });
}

/** Everything ever owed: initial total + charges (the "deuda total"). */
export function totalOwedOf(debt: DebtWithLedger): number {
  const initial = Number(debt.totalToRepay ?? debt.principal);
  const charges = debt.charges.reduce(
    (sum, c) => sum + Number(c.totalToRepay),
    0,
  );
  return Math.round((initial + charges) * 100) / 100;
}

/**
 * Purchases of a purchase-financing loan that are paid in installments: the
 * initial one (bought on the debt's start date) plus every charge with a term.
 */
export function financedCharges(debt: {
  startDate: Date | null;
  principal: Prisma.Decimal;
  totalToRepay: Prisma.Decimal | null;
  installmentsTotal: number | null;
  charges: {
    date: Date;
    totalToRepay: Prisma.Decimal;
    installments: number | null;
  }[];
}): FinancedCharge[] {
  const charges: FinancedCharge[] = [];
  if (debt.installmentsTotal && debt.startDate) {
    charges.push({
      date: debt.startDate,
      totalToRepay: Number(debt.totalToRepay ?? debt.principal),
      installments: debt.installmentsTotal,
    });
  }
  for (const charge of debt.charges) {
    if (charge.installments) {
      charges.push({
        date: charge.date,
        totalToRepay: Number(charge.totalToRepay),
        installments: charge.installments,
      });
    }
  }
  return charges;
}

/**
 * Marks the debt paid off when nothing is owed (and stops its schedule), or
 * active again when a charge or a reopened payment makes it owe money.
 */
export async function syncDebtStatus(tx: Client, debtId: string) {
  const debt = await tx.debt.findUnique({
    where: { id: debtId },
    include: { payments: true, charges: true, recurringExpense: true },
  });
  if (!debt) return;

  // Nothing owed yet (a personal loan started at 0) is not paid off.
  const status =
    balanceOf(debt) > 0 || totalOwedOf(debt) <= 0
      ? DebtStatus.active
      : DebtStatus.paid_off;
  if (status !== debt.status) {
    await tx.debt.update({ where: { id: debtId }, data: { status } });
  }

  const expense = debt.recurringExpense;
  if (!expense) return;
  if (status === DebtStatus.paid_off && expense.active) {
    await tx.recurringExpense.update({
      where: { id: expense.id },
      data: { active: false, nextDueDate: null },
    });
    await tx.recurringOccurrence.deleteMany({
      where: {
        recurringExpenseId: expense.id,
        status: OccurrenceStatus.upcoming,
      },
    });
  } else if (status === DebtStatus.active && !expense.active) {
    await tx.recurringExpense.update({
      where: { id: expense.id },
      data: { active: true },
    });
  }
}

export interface MovementInput {
  userId: string;
  accountId: string;
  type: TransactionType;
  amount: number;
  date: Date;
  description: string;
  categoryId?: string | null;
}

/**
 * A manual movement created inside the caller's DB transaction, with its
 * effect on the account balance: income and deposits add, expenses take.
 */
export async function createMovement(tx: Client, input: MovementInput) {
  const account = await tx.account.findFirst({
    where: { id: input.accountId, userId: input.userId },
    select: { id: true, currency: true },
  });
  if (!account) return null;

  const transaction = await tx.transaction.create({
    data: {
      userId: input.userId,
      accountId: account.id,
      categoryId: input.categoryId ?? null,
      type: input.type,
      amount: input.amount,
      currency: account.currency,
      txnDate: toDateOnly(input.date),
      description: input.description,
      merchantName: input.description,
      source: TransactionSource.manual,
    },
  });
  const moneyIn =
    input.type === TransactionType.income ||
    input.type === TransactionType.adjustment;
  await tx.account.update({
    where: { id: account.id },
    data: {
      balanceCurrent: { increment: moneyIn ? input.amount : -input.amount },
    },
  });
  return transaction;
}

/** Reverts and deletes a deposit created by `createMovement`. */
export async function deleteDeposit(tx: Client, transactionId: string) {
  const transaction = await tx.transaction.findUnique({
    where: { id: transactionId },
  });
  if (!transaction) return;
  if (!transaction.isPending) {
    await tx.account.update({
      where: { id: transaction.accountId },
      data: { balanceCurrent: { decrement: Number(transaction.amount) } },
    });
  }
  await tx.transaction.delete({ where: { id: transactionId } });
}

/** Default purchase date of a financed purchase: the day before its first payment. */
export function defaultPurchaseDate(firstPaymentDate: Date): Date {
  return addDays(toDateOnly(firstPaymentDate), -1);
}

export function isPurchaseFinancing(debt: { loanType: LoanType | null }) {
  return debt.loanType === LoanType.purchase_financing;
}
