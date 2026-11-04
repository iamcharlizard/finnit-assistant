import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service';
import {
  Debt,
  CreateDebtInput,
  UpdateDebtInput,
  CreateDebtPaymentInput,
  DebtConnection,
  DebtsArgs,
  DebtSummary,
  DebtPayoffProjection,
  PayoffStrategyInput,
  DebtPayment,
  DebtCharge,
  MAX_ANNUAL_RATE,
} from './dto/debt.dto';
import {
  NotFoundError,
  ValidationError,
  DebtOverpaymentError,
} from '../../common/exceptions/graphql-error.exception';
import { KeysetPage } from '../../common/utils/keyset-pagination.util';
import {
  OccurrenceMatchSource,
  OccurrenceStatus,
  Prisma,
  TransactionType,
} from '@finnit/database';
import { RecurringExpensesService } from '../recurring-expenses/recurring-expenses.service';
import { monthlyEquivalent } from '../recurring-expenses/schedule.util';
import {
  balanceOf,
  deleteDeposit,
  syncChargeHistory,
  syncDebtStatus,
  totalOwedOf,
} from './debt-ledger';

/** What every read of a debt loads. */
export const DEBT_INCLUDE = {
  payments: { orderBy: [{ date: 'desc' }, { id: 'desc' }] },
  charges: {
    orderBy: [{ date: 'desc' }, { id: 'desc' }],
    include: { transaction: { select: { accountId: true, type: true } } },
  },
  recurringExpense: { select: { id: true, nextDueDate: true } },
} satisfies Prisma.DebtInclude;

export type DebtRow = Prisma.DebtGetPayload<{ include: typeof DEBT_INCLUDE }>;

/** Monthly amount a debt asks for: its minimum, else its payments per month. */
export function monthlyPaymentOf(debt: {
  minPaymentAmount: Prisma.Decimal | null;
  installmentAmount: Prisma.Decimal | null;
  paymentFrequency: DebtRow['paymentFrequency'];
}): number {
  if (debt.minPaymentAmount) return Number(debt.minPaymentAmount);
  if (debt.installmentAmount && debt.paymentFrequency) {
    return monthlyEquivalent(
      Number(debt.installmentAmount),
      debt.paymentFrequency,
      1,
    );
  }
  return 0;
}

/** Days after a payment's date an open scheduled payment may still be its match. */
const PAYMENT_MATCH_DAYS = 20;

/** A debt as the payoff simulation sees it. */
export interface PayoffDebt {
  id: string;
  balance: number;
  minPayment: number;
  /** Monthly rate as a fraction (24% a year → 0.02). */
  monthlyRate: number;
}

export interface PayoffResult {
  id: string;
  /** Months until paid off; null when it never is (within the limit). */
  months: number | null;
  totalInterest: number;
}

/** 50 years: beyond this a plan is "never" for practical purposes. */
export const PAYOFF_MAX_MONTHS = 600;

const cents = (amount: number) => Math.round(amount * 100) / 100;

/**
 * Month by month payoff of several debts paid together, in priority order.
 * Each month every open debt accrues its interest and gets its minimum
 * payment; what is left of the monthly budget (the extra payment plus the
 * minimums of debts already paid off) goes to the first open debt in the
 * order, and on to the next when that one is paid off. The budget stays the
 * same every month (sum of minimums + extra), so paid-off minimums roll
 * over: the snowball/avalanche effect.
 */
export function simulatePayoff(
  debts: PayoffDebt[],
  extraPayment: number,
): PayoffResult[] {
  const balances = debts.map((d) => cents(d.balance));
  const interest = debts.map(() => 0);
  const months: (number | null)[] = debts.map((_, i) =>
    balances[i] > 0 ? null : 0,
  );
  const budget = cents(
    debts.reduce((sum, d) => sum + Math.max(0, d.minPayment), 0) +
      Math.max(0, extraPayment),
  );
  const open = () => balances.some((b) => b > 0);

  for (let month = 1; month <= PAYOFF_MAX_MONTHS && open(); month++) {
    if (budget <= 0) break; // nothing is ever paid
    let available = budget;

    debts.forEach((debt, i) => {
      if (balances[i] <= 0) return;
      const charge = cents(balances[i] * debt.monthlyRate);
      balances[i] = cents(balances[i] + charge);
      interest[i] = cents(interest[i] + charge);
    });
    debts.forEach((debt, i) => {
      if (balances[i] <= 0) return;
      const pay = Math.min(balances[i], Math.max(0, debt.minPayment));
      balances[i] = cents(balances[i] - pay);
      available = cents(available - pay);
    });
    for (let i = 0; i < debts.length && available > 0; i++) {
      if (balances[i] <= 0) continue;
      const pay = Math.min(balances[i], available);
      balances[i] = cents(balances[i] - pay);
      available = cents(available - pay);
    }
    balances.forEach((balance, i) => {
      if (balance <= 0 && months[i] === null) months[i] = month;
    });
  }

  return debts.map((debt, i) => ({
    id: debt.id,
    months: months[i],
    totalInterest: interest[i],
  }));
}

@Injectable()
export class DebtsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recurring: RecurringExpensesService,
  ) {}

  async create(userId: string, input: CreateDebtInput): Promise<Debt> {
    // Enforced here: no ValidationPipe runs the DTO's decorators.
    if (!(input.principal > 0)) {
      throw new ValidationError('The principal must be greater than 0');
    }
    if (
      input.interestRateAnnual != null &&
      !(
        input.interestRateAnnual >= 0 &&
        input.interestRateAnnual <= MAX_ANNUAL_RATE
      )
    ) {
      throw new ValidationError(
        `The annual interest rate must be between 0 and ${MAX_ANNUAL_RATE}`,
      );
    }

    // Validate linked account if provided
    if (input.linkedAccountId) {
      const account = await this.prisma.account.findFirst({
        where: { id: input.linkedAccountId, userId },
      });

      if (!account) {
        throw new NotFoundError('Linked account not found');
      }
    }

    const debt = await this.prisma.debt.create({
      data: {
        userId,
        name: input.name,
        kind: input.kind,
        principal: input.principal,
        interestRateAnnual: input.interestRateAnnual,
        minPaymentAmount: input.minPaymentAmount,
        startDate: input.startDate,
        dueDate: input.dueDate,
        linkedAccountId: input.linkedAccountId,
        lenderName: input.lenderName?.trim() || null,
      },
      include: DEBT_INCLUDE,
    });

    return this.mapDebt(debt);
  }

  async findMany(userId: string, args: DebtsArgs): Promise<DebtConnection> {
    const where: Prisma.DebtWhereInput = { userId };

    if (args.kind) {
      where.kind = args.kind;
    }

    // Newest first; the cursor resolves to (createdAt, id).
    const page = new KeysetPage(args);
    const debts = await this.prisma.debt.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...page.query,
      include: DEBT_INCLUDE,
    });

    const totalCount = await this.prisma.debt.count({ where });

    return page.toConnection(debts, totalCount, (debt) => this.mapDebt(debt));
  }

  async findById(id: string, userId: string): Promise<Debt> {
    const debt = await this.prisma.debt.findFirst({
      where: { id, userId },
      include: DEBT_INCLUDE,
    });

    if (!debt) {
      throw new NotFoundError('Debt not found');
    }

    return this.mapDebt(debt);
  }

  async update(
    id: string,
    userId: string,
    input: UpdateDebtInput,
  ): Promise<Debt> {
    const existingDebt = await this.prisma.debt.findFirst({
      where: { id, userId },
      include: DEBT_INCLUDE,
    });

    if (!existingDebt) {
      throw new NotFoundError('Debt not found');
    }

    // Enforced here: no ValidationPipe runs the DTO's decorators.
    if (input.name != null && !input.name.trim()) {
      throw new ValidationError('The name cannot be empty');
    }
    if (input.principal != null) {
      if (!(input.principal > 0)) {
        throw new ValidationError('The principal must be greater than 0');
      }
      if (existingDebt.totalToRepay !== null) {
        throw new ValidationError(
          'The principal of a loan with terms cannot change',
        );
      }
      const paid = existingDebt.payments.reduce(
        (sum, payment) => sum + Number(payment.amount),
        0,
      );
      const charges =
        totalOwedOf(existingDebt) - Number(existingDebt.principal);
      if (input.principal + charges < paid) {
        throw new ValidationError(
          `The principal cannot be less than what has been paid (${paid})`,
        );
      }
    }
    if (
      input.interestRateAnnual != null &&
      !(
        input.interestRateAnnual >= 0 &&
        input.interestRateAnnual <= MAX_ANNUAL_RATE
      )
    ) {
      throw new ValidationError(
        `The annual interest rate must be between 0 and ${MAX_ANNUAL_RATE}`,
      );
    }
    if (input.minPaymentAmount != null && !(input.minPaymentAmount > 0)) {
      throw new ValidationError('The minimum payment must be greater than 0');
    }

    // Validate linked account if being changed
    if (input.linkedAccountId) {
      const account = await this.prisma.account.findFirst({
        where: { id: input.linkedAccountId, userId },
      });

      if (!account) {
        throw new NotFoundError('Linked account not found');
      }
    }

    if (input.purposeCategoryId) {
      const category = await this.prisma.category.findFirst({
        where: {
          id: input.purposeCategoryId,
          OR: [{ userId }, { userId: null, isDefault: true }],
        },
        select: { id: true },
      });
      if (!category) throw new NotFoundError('Category not found');
    }

    const { lenderName, purposeCategoryId, ...fields } = input;
    const updatedDebt = await this.prisma.$transaction(async (tx) => {
      await tx.debt.update({
        where: { id },
        data: {
          ...fields,
          ...(lenderName !== undefined && {
            lenderName: lenderName?.trim() || null,
          }),
          ...(purposeCategoryId !== undefined && {
            purposeCategoryId: purposeCategoryId || null,
          }),
        },
      });
      // A new principal can pay a debt off or make it owe again.
      await syncDebtStatus(tx, id);
      return tx.debt.findUniqueOrThrow({
        where: { id },
        include: DEBT_INCLUDE,
      });
    });

    return this.mapDebt(updatedDebt);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const debt = await this.prisma.debt.findFirst({
      where: { id, userId },
      include: DEBT_INCLUDE,
    });

    if (!debt) {
      throw new NotFoundError('Debt not found');
    }

    // Historical payments are no movement: they go with the debt.
    if (debt.payments.some((payment) => payment.transactionId)) {
      throw new ValidationError('Cannot delete debt with existing payments');
    }

    await this.prisma.$transaction(async (tx) => {
      // The money it put into accounts and its payment schedule go too.
      const deposits = [
        debt.disbursementTransactionId,
        ...debt.charges.map((charge) => charge.transactionId),
      ].filter((id): id is string => Boolean(id));
      await tx.debt.update({
        where: { id },
        data: { disbursementTransactionId: null },
      });
      await tx.debtCharge.deleteMany({ where: { debtId: id } });
      for (const transactionId of deposits) {
        await deleteDeposit(tx, transactionId);
      }
      if (debt.recurringExpense) {
        await tx.recurringExpense.delete({
          where: { id: debt.recurringExpense.id },
        });
      }
      await tx.debt.delete({ where: { id } });
    });

    return true;
  }

  async createPayment(
    userId: string,
    input: CreateDebtPaymentInput,
  ): Promise<DebtPayment> {
    if (!(input.amount > 0)) {
      throw new ValidationError('The payment must be greater than 0');
    }

    const isHistorical = input.isHistorical ?? false;
    if (isHistorical === Boolean(input.transactionId)) {
      throw new ValidationError(
        'A payment needs the movement that paid it, unless it is historical',
      );
    }

    const debt = await this.prisma.debt.findFirst({
      where: { id: input.debtId, userId },
      include: DEBT_INCLUDE,
    });

    if (!debt) {
      throw new NotFoundError('Debt not found');
    }

    // Validate transaction belongs to user
    if (input.transactionId) {
      const transaction = await this.prisma.transaction.findFirst({
        where: { id: input.transactionId, userId },
      });

      if (!transaction) {
        throw new NotFoundError('Transaction not found');
      }
    }

    // Check if payment would exceed remaining debt
    const remainingBalance = balanceOf(debt);

    if (input.amount > remainingBalance) {
      throw new DebtOverpaymentError(
        `Payment amount (${input.amount}) exceeds remaining debt balance (${remainingBalance})`,
      );
    }

    const payment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.debtPayment.create({
        data: {
          debtId: input.debtId,
          transactionId: input.transactionId ?? null,
          isHistorical,
          amount: input.amount,
          date: input.date,
        },
      });
      if (input.transactionId) {
        await this.payScheduled(tx, debt.id, input.transactionId, input.date);
      }
      await syncDebtStatus(tx, debt.id);
      return created;
    });

    return this.mapDebtPayment(payment);
  }

  /**
   * Marks the debt's scheduled payment paid by this movement: the given one,
   * else the oldest open one due by `date` + a few days. No-op without a
   * schedule. The debt payment must already exist (it is not created twice).
   */
  async payScheduled(
    tx: Prisma.TransactionClient,
    debtId: string,
    transactionId: string,
    date: Date,
    occurrenceId?: string,
  ) {
    const occurrence = occurrenceId
      ? await tx.recurringOccurrence.findFirst({
          where: { id: occurrenceId, recurringExpense: { debtId } },
        })
      : await tx.recurringOccurrence.findFirst({
          where: {
            recurringExpense: { debtId },
            status: {
              in: [OccurrenceStatus.upcoming, OccurrenceStatus.missed],
            },
            dueDate: {
              lte: new Date(
                new Date(date).getTime() + PAYMENT_MATCH_DAYS * 86_400_000,
              ),
            },
          },
          orderBy: { dueDate: 'asc' },
        });
    if (occurrenceId && !occurrence) {
      throw new NotFoundError('Scheduled payment not found');
    }
    if (!occurrence) return;
    await this.recurring.markPaidInTransaction(
      tx,
      occurrence.id,
      transactionId,
      OccurrenceMatchSource.manual,
    );
  }

  /** Deletes a historical payment (one with no movement). */
  async deleteHistoricalPayment(id: string, userId: string): Promise<boolean> {
    const payment = await this.prisma.debtPayment.findFirst({
      where: { id, debt: { userId } },
    });
    if (!payment) throw new NotFoundError('Payment not found');
    if (payment.transactionId) {
      throw new ValidationError(
        'Only historical payments can be deleted; reopen the scheduled payment instead',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      if (payment.chargeId) {
        // An installment of a charge paid before registering it: one less
        // paid, so the schedule asks for it again.
        await tx.debtCharge.update({
          where: { id: payment.chargeId },
          data: { installmentsPaid: { decrement: 1 } },
        });
        await syncChargeHistory(tx, payment.chargeId);
        await this.recurring.resyncLoanOccurrences(tx, payment.debtId);
      } else {
        await tx.debtPayment.delete({ where: { id } });
      }
      await syncDebtStatus(tx, payment.debtId);
    });
    return true;
  }

  async getDebtSummary(userId: string): Promise<DebtSummary> {
    const debts = await this.prisma.debt.findMany({
      where: { userId },
      include: DEBT_INCLUDE,
    });

    let totalDebt = 0;
    let totalPaid = 0;
    let totalRemaining = 0;
    let totalMonthlyPayments = 0;
    const payoffProjections: DebtPayoffProjection[] = [];

    for (const debt of debts) {
      const paidAmount = debt.payments.reduce(
        (sum, payment) => sum + Number(payment.amount),
        0,
      );
      const remainingBalance = balanceOf(debt);
      const monthlyPayment = remainingBalance > 0 ? monthlyPaymentOf(debt) : 0;

      totalDebt += totalOwedOf(debt);
      totalPaid += paidAmount;
      totalRemaining += remainingBalance;
      totalMonthlyPayments += monthlyPayment;

      if (remainingBalance > 0 && monthlyPayment > 0) {
        const projection = this.calculatePayoffProjection(
          debt,
          remainingBalance,
          monthlyPayment,
        );
        payoffProjections.push(projection);
      }
    }

    return {
      totalDebt,
      totalPaid,
      totalRemaining,
      totalMonthlyPayments,
      payoffProjections: payoffProjections.sort(
        (a, b) => a.payoffDate.getTime() - b.payoffDate.getTime(),
      ),
    };
  }

  async calculatePayoffStrategy(
    userId: string,
    input: PayoffStrategyInput,
  ): Promise<DebtPayoffProjection[]> {
    if (!(input.extraPayment >= 0) || !Number.isFinite(input.extraPayment)) {
      throw new ValidationError('The extra payment must be 0 or more');
    }

    const debts = await this.prisma.debt.findMany({
      where: {
        userId,
        id: { in: input.debtIds },
      },
      include: DEBT_INCLUDE,
    });

    if (debts.length !== input.debtIds.length) {
      throw new NotFoundError('One or more debts not found');
    }

    // Calculate remaining balances
    const debtData = debts
      .map((debt) => {
        const remainingBalance = balanceOf(debt);
        const monthlyPayment = monthlyPaymentOf(debt);
        const interestRate = debt.interestRateAnnual
          ? Number(debt.interestRateAnnual) / 100 / 12
          : 0;

        return {
          debt,
          remainingBalance,
          monthlyPayment,
          interestRate,
        };
      })
      .filter((d) => d.remainingBalance > 0);

    // Avalanche: highest interest first (ties: smaller balance first).
    // Snowball: smallest balance first (ties: higher interest first).
    if (input.strategy === 'avalanche') {
      debtData.sort(
        (a, b) =>
          b.interestRate - a.interestRate ||
          a.remainingBalance - b.remainingBalance,
      );
    } else {
      debtData.sort(
        (a, b) =>
          a.remainingBalance - b.remainingBalance ||
          b.interestRate - a.interestRate,
      );
    }

    const results = simulatePayoff(
      debtData.map((d) => ({
        id: d.debt.id,
        balance: d.remainingBalance,
        minPayment: d.monthlyPayment,
        monthlyRate: d.interestRate,
      })),
      input.extraPayment,
    );

    // monthlyPayment: what the debt gets once it is the priority, i.e. its
    // minimum plus the extra plus the minimums of the debts paid before it.
    let rolledOver = input.extraPayment;
    return debtData.map(({ debt, remainingBalance, monthlyPayment }, i) => {
      const { months, totalInterest } = results[i];
      const payoffDate = new Date();
      payoffDate.setMonth(
        payoffDate.getMonth() + (months ?? PAYOFF_MAX_MONTHS),
      );
      const projection: DebtPayoffProjection = {
        debtId: debt.id,
        debtName: debt.name,
        currentBalance: remainingBalance,
        monthlyPayment: monthlyPayment + rolledOver,
        payoffDate,
        totalInterest,
        monthsToPayoff: months,
      };
      rolledOver += monthlyPayment;
      return projection;
    });
  }

  private calculateMonthsToPayoff(
    balance: number,
    payment: number,
    monthlyInterestRate: number,
  ): number {
    if (monthlyInterestRate === 0) {
      return balance / payment;
    }

    if (payment <= balance * monthlyInterestRate) {
      return 999; // Payment is too low to cover interest
    }

    // n = -ln(1 - rB/P) / ln(1 + r)
    return (
      -Math.log(1 - (balance * monthlyInterestRate) / payment) /
      Math.log(1 + monthlyInterestRate)
    );
  }

  private calculatePayoffProjection(
    debt: Prisma.DebtGetPayload<Record<string, never>>,
    remainingBalance: number,
    monthlyPayment: number,
  ): DebtPayoffProjection {
    const interestRate = debt.interestRateAnnual
      ? Number(debt.interestRateAnnual) / 100 / 12
      : 0;
    const months = this.calculateMonthsToPayoff(
      remainingBalance,
      monthlyPayment,
      interestRate,
    );

    const payoffDate = new Date();
    payoffDate.setMonth(payoffDate.getMonth() + Math.ceil(months));

    const totalInterest = Math.max(
      0,
      monthlyPayment * months - remainingBalance,
    );

    return {
      debtId: debt.id,
      debtName: debt.name,
      currentBalance: remainingBalance,
      monthlyPayment,
      payoffDate,
      totalInterest,
      // 999 is the "never" sentinel of calculateMonthsToPayoff.
      monthsToPayoff: months >= 999 ? null : Math.ceil(months),
    };
  }

  mapDebt(debt: DebtRow): Debt {
    const payments = debt.payments.map((p) => this.mapDebtPayment(p));
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const historicalPaid = payments
      .filter((p) => p.isHistorical)
      .reduce((sum, p) => sum + p.amount, 0);
    const monthlyPayment = monthlyPaymentOf(debt);

    return {
      id: debt.id,
      userId: debt.userId,
      name: debt.name,
      description: debt.description ?? undefined,
      kind: debt.kind,
      principal: Number(debt.principal),
      interestRateAnnual: debt.interestRateAnnual
        ? Number(debt.interestRateAnnual)
        : undefined,
      minPaymentAmount: debt.minPaymentAmount
        ? Number(debt.minPaymentAmount)
        : undefined,
      startDate: debt.startDate || undefined,
      dueDate: debt.dueDate || undefined,
      linkedAccountId: debt.linkedAccountId || undefined,
      loanType: debt.loanType ?? undefined,
      status: debt.status,
      lenderName: debt.lenderName ?? undefined,
      lenderContactId: debt.lenderContactId ?? undefined,
      lendingMethod: debt.lendingMethod ?? undefined,
      paymentFrequency: debt.paymentFrequency ?? undefined,
      installmentsTotal: debt.installmentsTotal ?? undefined,
      installmentsPaid: payments.length,
      installmentAmount: debt.installmentAmount
        ? Number(debt.installmentAmount)
        : undefined,
      totalToRepay: debt.totalToRepay ? Number(debt.totalToRepay) : undefined,
      interestMode: debt.interestMode ?? undefined,
      includesVat: debt.includesVat,
      openingFee: debt.openingFee ? Number(debt.openingFee) : undefined,
      periodicFee: debt.periodicFee ? Number(debt.periodicFee) : undefined,
      destination: debt.destination ?? undefined,
      purposeCategoryId: debt.purposeCategoryId ?? undefined,
      disbursementTransactionId: debt.disbursementTransactionId ?? undefined,
      depositAddsToBalance: debt.depositAddsToBalance,
      recurringExpenseId: debt.recurringExpense?.id,
      nextPaymentDate: debt.recurringExpense?.nextDueDate ?? undefined,
      createdAt: debt.createdAt,
      updatedAt: debt.updatedAt,
      remainingBalance: balanceOf(debt),
      totalPaid: Math.round(totalPaid * 100) / 100,
      historicalPaid: Math.round(historicalPaid * 100) / 100,
      totalOwed: totalOwedOf(debt),
      monthlyPayment: monthlyPayment > 0 ? monthlyPayment : undefined,
      payments,
      charges: debt.charges.map((c) => this.mapDebtCharge(c)),
    };
  }

  mapDebtCharge(charge: DebtRow['charges'][number]): DebtCharge {
    return {
      id: charge.id,
      debtId: charge.debtId,
      date: charge.date,
      description: charge.description ?? undefined,
      principal: Number(charge.principal),
      totalToRepay: Number(charge.totalToRepay),
      installments: charge.installments ?? undefined,
      installmentsPaid: charge.installmentsPaid,
      firstPaymentDate: charge.firstPaymentDate ?? undefined,
      interestMode: charge.interestMode ?? undefined,
      interestRateAnnual:
        charge.interestRateAnnual === null
          ? undefined
          : Number(charge.interestRateAnnual),
      includesVat: charge.includesVat,
      destination: charge.destination,
      transactionId: charge.transactionId ?? undefined,
      depositAccountId: charge.transaction?.accountId,
      depositCountsAsIncome: charge.transaction
        ? charge.transaction.type === TransactionType.income
        : undefined,
      depositAddsToBalance: charge.depositAddsToBalance,
      purposeCategoryId: charge.purposeCategoryId ?? undefined,
      lendingMethod: charge.lendingMethod ?? undefined,
      createdAt: charge.createdAt,
    };
  }

  mapDebtPayment(
    payment: Prisma.DebtPaymentGetPayload<Record<string, never>>,
  ): DebtPayment {
    return {
      id: payment.id,
      debtId: payment.debtId,
      transactionId: payment.transactionId,
      isHistorical: payment.isHistorical,
      amount: Number(payment.amount),
      date: payment.date,
    };
  }
}
