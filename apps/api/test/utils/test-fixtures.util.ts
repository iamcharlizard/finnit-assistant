import { PrismaClient, AccountType, TransactionType, TransactionSource, DebtKind } from '@finnit/database';
import * as bcrypt from 'bcrypt';

export interface TestUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
}

export interface TestAccount {
  id: string;
  userId: string;
  type: AccountType;
  name: string;
  currency: string;
  balanceCurrent: number;
}

export interface TestTransaction {
  id: string;
  userId: string;
  accountId: string;
  categoryId?: string;
  type: TransactionType;
  amount: number;
  currency: string;
  txnDate: Date;
  description?: string;
}

export interface TestCategory {
  id: string;
  userId: string;
  name: string;
  parentId?: string;
}

export interface TestBudget {
  id: string;
  userId: string;
  year: number;
  month: number;
  currency: string;
  amountTotal?: number;
}

export interface TestGoal {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: string;
  dueDate?: Date;
}

export interface TestDebt {
  id: string;
  userId: string;
  name: string;
  kind: DebtKind;
  principal: number;
  interestRateAnnual?: number;
  minPaymentAmount?: number;
}

export class TestFixturesUtil {
  constructor(private readonly prisma: PrismaClient) {}

  async createTestUser(overrides: Partial<TestUser> = {}): Promise<TestUser> {
    const defaultUser = {
      name: 'Test User',
      email: `test-${Date.now()}@example.com`,
      passwordHash: await bcrypt.hash('password123', 10),
    };

    const userData = { ...defaultUser, ...overrides };

    const user = await this.prisma.user.create({
      data: userData,
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      passwordHash: user.passwordHash,
    };
  }

  async createTestAccount(userId: string, overrides: Partial<TestAccount> = {}): Promise<TestAccount> {
    const defaultAccount = {
      type: AccountType.cash,
      name: `Test Account ${Date.now()}`,
      currency: 'USD',
      balanceCurrent: 1000.00,
    };

    const accountData = { ...defaultAccount, ...overrides, userId };

    const account = await this.prisma.account.create({
      data: {
        ...accountData,
        balanceCurrent: accountData.balanceCurrent,
      },
    });

    return {
      id: account.id,
      userId: account.userId,
      type: account.type,
      name: account.name,
      currency: account.currency,
      balanceCurrent: Number(account.balanceCurrent),
    };
  }

  async createTestCategory(userId: string, overrides: Partial<TestCategory> = {}): Promise<TestCategory> {
    const defaultCategory = {
      name: `Test Category ${Date.now()}`,
    };

    const categoryData = { ...defaultCategory, ...overrides, userId };

    const category = await this.prisma.category.create({
      data: categoryData,
    });

    return {
      id: category.id,
      userId: category.userId,
      name: category.name,
      parentId: category.parentId,
    };
  }

  async createTestTransaction(
    userId: string,
    accountId: string,
    overrides: Partial<TestTransaction> = {}
  ): Promise<TestTransaction> {
    const defaultTransaction = {
      type: TransactionType.expense,
      amount: 100.00,
      currency: 'USD',
      txnDate: new Date(),
      description: 'Test transaction',
      source: TransactionSource.manual,
    };

    const transactionData = { 
      ...defaultTransaction, 
      ...overrides, 
      userId, 
      accountId,
      amount: overrides.amount ?? defaultTransaction.amount,
    };

    const transaction = await this.prisma.transaction.create({
      data: transactionData,
    });

    return {
      id: transaction.id,
      userId: transaction.userId,
      accountId: transaction.accountId,
      categoryId: transaction.categoryId,
      type: transaction.type,
      amount: Number(transaction.amount),
      currency: transaction.currency,
      txnDate: transaction.txnDate,
      description: transaction.description,
    };
  }

  async createTestBudget(userId: string, overrides: Partial<TestBudget> = {}): Promise<TestBudget> {
    const currentDate = new Date();
    const defaultBudget = {
      year: currentDate.getFullYear(),
      month: currentDate.getMonth() + 1,
      currency: 'USD',
      amountTotal: 2000.00,
    };

    const budgetData = { ...defaultBudget, ...overrides, userId };

    const budget = await this.prisma.budget.create({
      data: {
        ...budgetData,
        amountTotal: budgetData.amountTotal,
      },
    });

    return {
      id: budget.id,
      userId: budget.userId,
      year: budget.year,
      month: budget.month,
      currency: budget.currency,
      amountTotal: budget.amountTotal ? Number(budget.amountTotal) : undefined,
    };
  }

  async createTestGoal(userId: string, overrides: Partial<TestGoal> = {}): Promise<TestGoal> {
    const defaultGoal = {
      name: `Test Goal ${Date.now()}`,
      targetAmount: 5000.00,
      currentAmount: 1000.00,
      currency: 'USD',
      dueDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
    };

    const goalData = { ...defaultGoal, ...overrides, userId };

    const goal = await this.prisma.goal.create({
      data: {
        ...goalData,
        targetAmount: goalData.targetAmount,
        currentAmount: goalData.currentAmount,
      },
    });

    return {
      id: goal.id,
      userId: goal.userId,
      name: goal.name,
      targetAmount: Number(goal.targetAmount),
      currentAmount: Number(goal.currentAmount),
      currency: goal.currency,
      dueDate: goal.dueDate,
    };
  }

  async createTestDebt(userId: string, overrides: Partial<TestDebt> = {}): Promise<TestDebt> {
    const defaultDebt = {
      name: `Test Debt ${Date.now()}`,
      kind: DebtKind.loan,
      principal: 10000.00,
      interestRateAnnual: 5.5,
      minPaymentAmount: 200.00,
    };

    const debtData = { ...defaultDebt, ...overrides, userId };

    const debt = await this.prisma.debt.create({
      data: {
        ...debtData,
        principal: debtData.principal,
        interestRateAnnual: debtData.interestRateAnnual,
        minPaymentAmount: debtData.minPaymentAmount,
      },
    });

    return {
      id: debt.id,
      userId: debt.userId,
      name: debt.name,
      kind: debt.kind,
      principal: Number(debt.principal),
      interestRateAnnual: debt.interestRateAnnual ? Number(debt.interestRateAnnual) : undefined,
      minPaymentAmount: debt.minPaymentAmount ? Number(debt.minPaymentAmount) : undefined,
    };
  }

  async createCompleteUserScenario() {
    // Create user
    const user = await this.createTestUser();

    // Create accounts
    const cashAccount = await this.createTestAccount(user.id, {
      type: AccountType.cash,
      name: 'Cash Account',
      balanceCurrent: 2000.00,
    });

    const creditAccount = await this.createTestAccount(user.id, {
      type: AccountType.credit,
      name: 'Credit Card',
      balanceCurrent: -500.00,
    });

    const savingsAccount = await this.createTestAccount(user.id, {
      type: AccountType.savings,
      name: 'Savings Account',
      balanceCurrent: 10000.00,
    });

    // Create categories
    const expenseCategory = await this.createTestCategory(user.id, {
      name: 'Food & Dining',
    });

    const incomeCategory = await this.createTestCategory(user.id, {
      name: 'Salary',
    });

    // Create transactions
    const expenseTransaction = await this.createTestTransaction(user.id, cashAccount.id, {
      categoryId: expenseCategory.id,
      type: TransactionType.expense,
      amount: 50.00,
      description: 'Restaurant dinner',
    });

    const incomeTransaction = await this.createTestTransaction(user.id, cashAccount.id, {
      categoryId: incomeCategory.id,
      type: TransactionType.income,
      amount: 3000.00,
      description: 'Monthly salary',
    });

    // Create budget
    const budget = await this.createTestBudget(user.id, {
      amountTotal: 2500.00,
    });

    // Create budget category cap
    await this.prisma.bUDGET_CATEGORY.create({
      data: {
        budgetId: budget.id,
        categoryId: expenseCategory.id,
        capAmount: 300.00,
      },
    });

    // Create goal
    const goal = await this.createTestGoal(user.id, {
      name: 'Emergency Fund',
      targetAmount: 15000.00,
      currentAmount: 5000.00,
    });

    // Create debt
    const debt = await this.createTestDebt(user.id, {
      name: 'Car Loan',
      kind: DebtKind.loan,
      principal: 25000.00,
      interestRateAnnual: 4.5,
      minPaymentAmount: 450.00,
    });

    return {
      user,
      accounts: {
        cash: cashAccount,
        credit: creditAccount,
        savings: savingsAccount,
      },
      categories: {
        expense: expenseCategory,
        income: incomeCategory,
      },
      transactions: {
        expense: expenseTransaction,
        income: incomeTransaction,
      },
      budget,
      goal,
      debt,
    };
  }
}