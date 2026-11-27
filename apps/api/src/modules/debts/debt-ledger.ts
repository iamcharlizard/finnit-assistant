import {
  DebtChargeDestination,
  DebtStatus,
  LoanType,
  OccurrenceStatus,
  Prisma,
  TransactionSource,
  TransactionType,
} from '@finnit/database';
import {
  appliedEffect,
  effectOf,
  moveBalance,
} from '../../common/utils/balance-effect.util';
import {
  addDays,
  dueDatesAfter,
  toDateOnly,
} from '../recurring-expenses/schedule.util';
import {
  chargeDueDates,
  debtBalance,
  FinancedCharge,
  splitInstallments,
} from './loan-math';

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
 * What a loan scheduled by its charges pays in installments: the initial
 * amount (on the debt's start date) when it has a term, plus every charge
 * with a term.
 */
export function financedCharges(debt: {
  description: string | null;
  startDate: Date | null;
  principal: Prisma.Decimal;
  totalToRepay: Prisma.Decimal | null;
  installmentsTotal: number | null;
  charges: {
    id: string;
    date: Date;
    description: string | null;
    totalToRepay: Prisma.Decimal;
    installments: number | null;
    installmentsPaid: number;
    firstPaymentDate: Date | null;
  }[];
}): FinancedCharge[] {
  const charges: FinancedCharge[] = [];
  if (debt.installmentsTotal && debt.startDate) {
    charges.push({
      date: debt.startDate,
      totalToRepay: Number(debt.totalToRepay ?? debt.principal),
      installments: debt.installmentsTotal,
      description: debt.description,
      chargeId: null,
    });
  }
  for (const charge of debt.charges) {
    if (charge.installments) {
      charges.push({
        date: charge.date,
        totalToRepay: Number(charge.totalToRepay),
        installments: charge.installments,
        installmentsPaid: charge.installmentsPaid,
        firstPaymentDate: charge.firstPaymentDate,
        description: charge.description,
        chargeId: charge.id,
      });
    }
  }
  // By purchase date: each payment lists what it covers in that order.
  return charges.sort((a, b) => a.date.getTime() - b.date.getTime());
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

  const moneyIn =
    input.type === TransactionType.income ||
    input.type === TransactionType.adjustment;
  const effect = moneyIn ? input.amount : -input.amount;
  const transaction = await tx.transaction.create({
    data: {
      userId: input.userId,
      accountId: account.id,
      categoryId: input.categoryId ?? null,
      type: input.type,
      amount: input.amount,
      balanceEffect: effect,
      currency: account.currency,
      txnDate: toDateOnly(input.date),
      description: input.description,
      merchantName: input.description,
      source: TransactionSource.manual,
    },
  });
  await moveBalance(tx, account.id, effect);
  return transaction;
}

/**
 * The installments of a charge paid before registering it, as of where they
 * fall on the loan's schedule: the first `installmentsPaid` (amount, due
 * date). Empty without installments or a schedule.
 */
export function paidInstallments(
  rule: Parameters<typeof dueDatesAfter>[0] | null,
  charge: {
    date: Date;
    totalToRepay: number;
    installments: number | null;
    installmentsPaid: number;
    firstPaymentDate: Date | null;
  },
): { date: Date; amount: number }[] {
  if (!rule || !charge.installments || charge.installmentsPaid <= 0) return [];
  const dates = chargeDueDates(rule, {
    ...charge,
    installments: charge.installments,
  });
  const amounts = splitInstallments(charge.totalToRepay, dates.length);
  return dates
    .slice(0, charge.installmentsPaid)
    .map((date, i) => ({ date, amount: amounts[i] }));
}

/**
 * Rewrites the historical payments of a charge from its `installmentsPaid`
 * (they stay out of income and expense totals).
 */
export async function syncChargeHistory(tx: Client, chargeId: string) {
  await tx.debtPayment.deleteMany({ where: { chargeId } });
  const charge = await tx.debtCharge.findUniqueOrThrow({
    where: { id: chargeId },
  });
  const rule = await tx.recurringExpense.findUnique({
    where: { debtId: charge.debtId },
  });
  const paid = paidInstallments(rule, {
    ...charge,
    totalToRepay: Number(charge.totalToRepay),
  });
  if (paid.length === 0) return;
  await tx.debtPayment.createMany({
    data: paid.map((p) => ({
      debtId: charge.debtId,
      chargeId,
      isHistorical: true,
      amount: p.amount,
      date: p.date,
    })),
  });
}

/** Reverts and deletes a deposit created by `createMovement`. */
export async function deleteDeposit(tx: Client, transactionId: string) {
  const transaction = await tx.transaction.findUnique({
    where: { id: transactionId },
  });
  if (!transaction) return;
  await moveBalance(
    tx,
    transaction.accountId,
    -appliedEffect(effectOf(transaction), transaction.isPending),
  );
  await tx.transaction.delete({ where: { id: transactionId } });
}

/** Default purchase date of a financed purchase: the day before its first payment. */
export function defaultPurchaseDate(firstPaymentDate: Date): Date {
  return addDays(toDateOnly(firstPaymentDate), -1);
}

/**
 * Purchase financing and personal loans are containers: every purchase or
 * amount, the first one too, is a DebtCharge; the debt only keeps the
 * loan's own data (name, lender, frequency, schedule).
 */
export function isLoanContainer(debt: { loanType: LoanType | null }) {
  return (
    debt.loanType === LoanType.purchase_financing ||
    debt.loanType === LoanType.personal
  );
}

/** Id of the charge holding a container's first amount. */
export const initialChargeId = (debtId: string) => `initial-${debtId}`;

/**
 * Moves a container's first amount from the debt to a charge, exactly as
 * migration 20261128090000_loan_containers does: the charge gets the terms
 * `financedCharges` derived from the debt, so the balance and the schedule
 * stay the same. Payments are not touched. No-op for other loans or when
 * the first amount is 0 (a personal loan started empty).
 */
export async function moveInitialAmountToCharge(tx: Client, debtId: string) {
  const debt = await tx.debt.findUniqueOrThrow({ where: { id: debtId } });
  if (!isLoanContainer(debt)) return;
  const total = Number(debt.totalToRepay ?? debt.principal);
  if (!(Number(debt.principal) > 0 || total > 0)) return;
  const byCharges = isScheduledByCharges(debt);
  const installments =
    byCharges && debt.installmentsTotal && debt.startDate
      ? debt.installmentsTotal
      : null;
  await tx.debt.update({
    where: { id: debtId },
    data: {
      principal: 0,
      totalToRepay: null,
      description: null,
      destination: null,
      depositAddsToBalance: true,
      disbursementTransactionId: null,
      purposeCategoryId: null,
      lendingMethod: null,
      ...(byCharges
        ? {
            installmentsTotal: null,
            interestMode: null,
            interestRateAnnual: null,
            includesVat: false,
          }
        : {}),
    },
  });
  await tx.debtCharge.create({
    data: {
      id: initialChargeId(debtId),
      debtId,
      date: debt.startDate ?? toDateOnly(debt.createdAt),
      description: debt.description,
      principal: debt.principal,
      totalToRepay: total,
      installments,
      installmentsPaid: 0,
      firstPaymentDate: null,
      interestMode: installments ? debt.interestMode : null,
      interestRateAnnual:
        installments && debt.interestMode === 'rate'
          ? debt.interestRateAnnual
          : null,
      includesVat:
        Boolean(installments) &&
        debt.interestMode === 'rate' &&
        debt.includesVat,
      destination:
        debt.destination ??
        (debt.loanType === LoanType.purchase_financing
          ? DebtChargeDestination.purchase
          : DebtChargeDestination.deposit),
      depositAddsToBalance: debt.depositAddsToBalance,
      transactionId: debt.disbursementTransactionId,
      purposeCategoryId: debt.purposeCategoryId,
      lendingMethod: debt.lendingMethod,
    },
  });
}

export function isPurchaseFinancing(debt: { loanType: LoanType | null }) {
  return debt.loanType === LoanType.purchase_financing;
}

/**
 * Loans whose payments come from their charges, each split into its own
 * installments: purchase financing, and personal loans without a fixed
 * payment (e.g. a purchase on the lender's card at 3 MSI).
 */
export function isScheduledByCharges(debt: {
  loanType: LoanType | null;
  installmentAmount: Prisma.Decimal | number | null;
}) {
  return (
    isPurchaseFinancing(debt) ||
    (debt.loanType === LoanType.personal && debt.installmentAmount === null)
  );
}
