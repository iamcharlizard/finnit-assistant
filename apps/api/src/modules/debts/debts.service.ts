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
  DebtOverpaymentError 
} from '../../common/exceptions/graphql-error.exception';
import { PaginationUtil } from '../../common/utils/pagination.util';

@Injectable()
export class DebtsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, input: CreateDebtInput): Promise<Debt> {
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
    const where: any = { userId };

    if (args.kind) {
      where.kind = args.kind;
    }

    // Handle cursor pagination
    const limit = args.first || args.last || 20;
    let cursor: any = undefined;

    if (args.after) {
      const decodedCursor = PaginationUtil.decodeCursor(args.after);
      cursor = { id: { gt: decodedCursor } };
    } else if (args.before) {
      const decodedCursor = PaginationUtil.decodeCursor(args.before);
      cursor = { id: { lt: decodedCursor } };
    }

    const debts = await this.prisma.debt.findMany({
      where: { ...where, ...cursor },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        payments: {
          orderBy: { date: 'desc' },
        },
      },
    });

    const totalCount = await this.prisma.debt.count({ where });

    const mappedDebts = await Promise.all(
      debts.map(async (debt) => {
        const totalPaid = debt.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
        return this.mapDebt(debt, debt.payments, totalPaid);
      })
    );

    return PaginationUtil.createConnection(
      mappedDebts,
      args,
      totalCount,
      (debt) => PaginationUtil.encodeCursor(debt.id),
    );
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

    const totalPaid = debt.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    return this.mapDebt(debt, debt.payments, totalPaid);
  }

  async update(id: string, userId: string, input: UpdateDebtInput): Promise<Debt> {
    const existingDebt = await this.prisma.debt.findFirst({
      where: { id, userId },
      include: { payments: true },
    });

    if (!existingDebt) {
      throw new NotFoundError('Debt not found');
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

    const totalPaid = updatedDebt.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
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

  async createPayment(userId: string, input: CreateDebtPaymentInput): Promise<DebtPayment> {
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
    const totalPaid = debt.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const remainingBalance = Number(debt.principal) - totalPaid;

    if (input.amount > remainingBalance) {
      throw new DebtOverpaymentError(`Payment amount (${input.amount}) exceeds remaining debt balance (${remainingBalance})`);
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
      const paidAmount = debt.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
      const remainingBalance = principal - paidAmount;
      const monthlyPayment = debt.minPaymentAmount ? Number(debt.minPaymentAmount) : 0;

      totalDebt += principal;
      totalPaid += paidAmount;
      totalMonthlyPayments += monthlyPayment;

      if (remainingBalance > 0 && monthlyPayment > 0) {
        const projection = this.calculatePayoffProjection(debt, remainingBalance, monthlyPayment);
        payoffProjections.push(projection);
      }
    }

    return {
      totalDebt,
      totalPaid,
      totalRemaining: totalDebt - totalPaid,
      totalMonthlyPayments,
      payoffProjections: payoffProjections.sort((a, b) => a.payoffDate.getTime() - b.payoffDate.getTime()),
    };
  }

  async calculatePayoffStrategy(userId: string, input: PayoffStrategyInput): Promise<DebtPayoffProjection[]> {
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
    const debtData = debts.map(debt => {
      const paidAmount = debt.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
      const remainingBalance = Number(debt.principal) - paidAmount;
      const monthlyPayment = debt.minPaymentAmount ? Number(debt.minPaymentAmount) : 0;
      const interestRate = debt.interestRateAnnual ? Number(debt.interestRateAnnual) / 100 / 12 : 0;

      return {
        debt,
        remainingBalance,
        monthlyPayment,
        interestRate,
      };
    }).filter(d => d.remainingBalance > 0);

    // Sort by strategy
    if (input.strategy === 'avalanche') {
      debtData.sort((a, b) => b.interestRate - a.interestRate); // Highest interest first
    } else {
      debtData.sort((a, b) => a.remainingBalance - b.remainingBalance); // Lowest balance first
    }

    // Calculate payoff with extra payment applied to priority debt
    const projections: DebtPayoffProjection[] = [];
    let remainingExtraPayment = input.extraPayment;

    for (const { debt, remainingBalance, monthlyPayment, interestRate } of debtData) {
      const totalPayment = monthlyPayment + remainingExtraPayment;
      
      // Calculate payoff time and interest
      const months = this.calculateMonthsToPayoff(remainingBalance, totalPayment, interestRate);
      const totalInterest = (totalPayment * months) - remainingBalance;
      const payoffDate = new Date();
      payoffDate.setMonth(payoffDate.getMonth() + Math.ceil(months));

      projections.push({
        debtId: debt.id,
        debtName: debt.name,
        currentBalance: remainingBalance,
        monthlyPayment: totalPayment,
        payoffDate,
        totalInterest: Math.max(0, totalInterest),
      });

      // After first debt is paid off, its payment becomes extra payment for the next
      remainingExtraPayment += monthlyPayment;
    }

    return projections;
  }

  private calculateMonthsToPayoff(balance: number, payment: number, monthlyInterestRate: number): number {
    if (monthlyInterestRate === 0) {
      return balance / payment;
    }

    if (payment <= balance * monthlyInterestRate) {
      return 999; // Payment is too low to cover interest
    }

    return Math.log(1 + (balance * monthlyInterestRate) / payment) / Math.log(1 + monthlyInterestRate);
  }

  private calculatePayoffProjection(debt: any, remainingBalance: number, monthlyPayment: number): DebtPayoffProjection {
    const interestRate = debt.interestRateAnnual ? Number(debt.interestRateAnnual) / 100 / 12 : 0;
    const months = this.calculateMonthsToPayoff(remainingBalance, monthlyPayment, interestRate);
    
    const payoffDate = new Date();
    payoffDate.setMonth(payoffDate.getMonth() + Math.ceil(months));
    
    const totalInterest = Math.max(0, (monthlyPayment * months) - remainingBalance);

    return {
      debtId: debt.id,
      debtName: debt.name,
      currentBalance: remainingBalance,
      monthlyPayment,
      payoffDate,
      totalInterest,
    };
  }

  private mapDebt(debt: any, payments: any[], totalPaid: number): Debt {
    const remainingBalance = Number(debt.principal) - totalPaid;

    return {
      id: debt.id,
      userId: debt.userId,
      name: debt.name,
      kind: debt.kind,
      principal: Number(debt.principal),
      interestRateAnnual: debt.interestRateAnnual ? Number(debt.interestRateAnnual) : undefined,
      minPaymentAmount: debt.minPaymentAmount ? Number(debt.minPaymentAmount) : undefined,
      startDate: debt.startDate,
      dueDate: debt.dueDate,
      linkedAccountId: debt.linkedAccountId,
      createdAt: debt.createdAt,
      remainingBalance: Math.max(0, remainingBalance),
      totalPaid,
      monthlyPayment: debt.minPaymentAmount ? Number(debt.minPaymentAmount) : undefined,
    };
  }

  private mapDebtPayment(payment: any): DebtPayment {
    return {
      id: payment.id,
      debtId: payment.debtId,
      transactionId: payment.transactionId,
      amount: Number(payment.amount),
      date: payment.date,
    };
  }
}