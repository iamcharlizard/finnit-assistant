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
} from './dto/debt.dto';
import {
  NotFoundError,
  ValidationError,
  DebtOverpaymentError,
} from '../../common/exceptions/graphql-error.exception';
import { KeysetPage } from '../../common/utils/keyset-pagination.util';
import { Prisma } from '@finnit/database';

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
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, input: CreateDebtInput): Promise<Debt> {
    // Enforced here: no ValidationPipe runs the DTO's decorators.
    if (!(input.principal > 0)) {
      throw new ValidationError('The principal must be greater than 0');
    }
    if (
      input.interestRateAnnual != null &&
      !(input.interestRateAnnual >= 0 && input.interestRateAnnual <= 100)
    ) {
      throw new ValidationError(
        'The annual interest rate must be between 0 and 100',
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
      },
    });

    return this.mapDebt(debt, [], 0);
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
      include: {
        payments: {
          orderBy: { date: 'desc' },
        },
      },
    });

    const totalCount = await this.prisma.debt.count({ where });

    return page.toConnection(debts, totalCount, (debt) => {
      const totalPaid = debt.payments.reduce(
        (sum, payment) => sum + Number(payment.amount),
        0,
      );
      return this.mapDebt(debt, debt.payments, totalPaid);
    });
  }

  async findById(id: string, userId: string): Promise<Debt> {
    const debt = await this.prisma.debt.findFirst({
      where: { id, userId },
      include: {
        payments: {
          orderBy: { date: 'desc' },
        },
      },
    });

    if (!debt) {
      throw new NotFoundError('Debt not found');
    }

    const totalPaid = debt.payments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0,
    );
    return this.mapDebt(debt, debt.payments, totalPaid);
  }

  async update(
    id: string,
    userId: string,
    input: UpdateDebtInput,
  ): Promise<Debt> {
    const existingDebt = await this.prisma.debt.findFirst({
      where: { id, userId },
      include: { payments: true },
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
      const paid = existingDebt.payments.reduce(
        (sum, payment) => sum + Number(payment.amount),
        0,
      );
      if (input.principal < paid) {
        throw new ValidationError(
          `The principal cannot be less than what has been paid (${paid})`,
        );
      }
    }
    if (
      input.interestRateAnnual != null &&
      !(input.interestRateAnnual >= 0 && input.interestRateAnnual <= 100)
    ) {
      throw new ValidationError(
        'The annual interest rate must be between 0 and 100',
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

    const updatedDebt = await this.prisma.debt.update({
      where: { id },
      data: input,
      include: { payments: true },
    });

    const totalPaid = updatedDebt.payments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0,
    );
    return this.mapDebt(updatedDebt, updatedDebt.payments, totalPaid);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const debt = await this.prisma.debt.findFirst({
      where: { id, userId },
      include: { payments: true },
    });

    if (!debt) {
      throw new NotFoundError('Debt not found');
    }

    if (debt.payments.length > 0) {
      throw new ValidationError('Cannot delete debt with existing payments');
    }

    await this.prisma.debt.delete({
      where: { id },
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

    const debt = await this.prisma.debt.findFirst({
      where: { id: input.debtId, userId },
      include: { payments: true },
    });

    if (!debt) {
      throw new NotFoundError('Debt not found');
    }

    // Validate transaction belongs to user
    const transaction = await this.prisma.transaction.findFirst({
      where: { id: input.transactionId, userId },
    });

    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }

    // Check if payment would exceed remaining debt
    const totalPaid = debt.payments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0,
    );
    const remainingBalance = Number(debt.principal) - totalPaid;

    if (input.amount > remainingBalance) {
      throw new DebtOverpaymentError(
        `Payment amount (${input.amount}) exceeds remaining debt balance (${remainingBalance})`,
      );
    }

    const payment = await this.prisma.debtPayment.create({
      data: {
        debtId: input.debtId,
        transactionId: input.transactionId,
        amount: input.amount,
        date: input.date,
      },
    });

    return this.mapDebtPayment(payment);
  }

  async getDebtSummary(userId: string): Promise<DebtSummary> {
    const debts = await this.prisma.debt.findMany({
      where: { userId },
      include: {
        payments: true,
      },
    });

    let totalDebt = 0;
    let totalPaid = 0;
    let totalMonthlyPayments = 0;
    const payoffProjections: DebtPayoffProjection[] = [];

    for (const debt of debts) {
      const principal = Number(debt.principal);
      const paidAmount = debt.payments.reduce(
        (sum, payment) => sum + Number(payment.amount),
        0,
      );
      const remainingBalance = principal - paidAmount;
      const monthlyPayment = debt.minPaymentAmount
        ? Number(debt.minPaymentAmount)
        : 0;

      totalDebt += principal;
      totalPaid += paidAmount;
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
      totalRemaining: totalDebt - totalPaid,
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
      include: { payments: true },
    });

    if (debts.length !== input.debtIds.length) {
      throw new NotFoundError('One or more debts not found');
    }

    // Calculate remaining balances
    const debtData = debts
      .map((debt) => {
        const paidAmount = debt.payments.reduce(
          (sum, payment) => sum + Number(payment.amount),
          0,
        );
        const remainingBalance = Number(debt.principal) - paidAmount;
        const monthlyPayment = debt.minPaymentAmount
          ? Number(debt.minPaymentAmount)
          : 0;
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

  private mapDebt(
    debt: Prisma.DebtGetPayload<Record<string, never>>,
    payments: Prisma.DebtPaymentGetPayload<Record<string, never>>[],
    totalPaid: number,
  ): Debt {
    const remainingBalance = Number(debt.principal) - totalPaid;

    return {
      id: debt.id,
      userId: debt.userId,
      name: debt.name,
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
      createdAt: debt.createdAt,
      remainingBalance: Math.max(0, remainingBalance),
      totalPaid,
      monthlyPayment: debt.minPaymentAmount
        ? Number(debt.minPaymentAmount)
        : undefined,
    };
  }

  private mapDebtPayment(
    payment: Prisma.DebtPaymentGetPayload<Record<string, never>>,
  ): DebtPayment {
    return {
      id: payment.id,
      debtId: payment.debtId,
      transactionId: payment.transactionId,
      amount: Number(payment.amount),
      date: payment.date,
    };
  }
}
