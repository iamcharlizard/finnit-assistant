import { PrismaClient } from '@finnit/database';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';

export type MockPrismaService = DeepMockProxy<PrismaClient>;

export const createMockPrismaService = (): MockPrismaService => {
  const mockPrisma = mockDeep<PrismaClient>();
  
  // Set up default mock implementations
  mockPrisma.$connect.mockResolvedValue();
  mockPrisma.$disconnect.mockResolvedValue();
  mockPrisma.$transaction.mockImplementation(async (callback) => {
    if (typeof callback === 'function') {
      return callback(mockPrisma);
    }
    return mockPrisma;
  });

  return mockPrisma;
};

// Common mock data factories
export const mockUserData = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  passwordHash: 'hashed-password',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

export const mockAccountData = {
  id: 'account-1',
  userId: 'user-1',
  type: 'cash' as const,
  name: 'Test Account',
  currency: 'USD',
  balanceCurrent: 1000.00,
  metadata: null,
  archived: false,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

export const mockTransactionData = {
  id: 'transaction-1',
  userId: 'user-1',
  accountId: 'account-1',
  categoryId: 'category-1',
  type: 'expense' as const,
  amount: 100.00,
  currency: 'USD',
  txnDate: new Date('2024-01-01'),
  description: 'Test transaction',
  merchantName: null,
  isPending: false,
  isRecurringInstance: false,
  source: 'manual' as const,
  externalId: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

export const mockCategoryData = {
  id: 'category-1',
  userId: 'user-1',
  parentId: null,
  name: 'Food & Dining',
  isDefault: false,
  sortOrder: 1,
  createdAt: new Date('2024-01-01'),
};

export const mockBudgetData = {
  id: 'budget-1',
  userId: 'user-1',
  year: 2024,
  month: 1,
  currency: 'USD',
  amountTotal: 2000.00,
  createdAt: new Date('2024-01-01'),
};

export const mockGoalData = {
  id: 'goal-1',
  userId: 'user-1',
  name: 'Emergency Fund',
  targetAmount: 10000.00,
  currentAmount: 3000.00,
  currency: 'USD',
  dueDate: new Date('2024-12-31'),
  createdAt: new Date('2024-01-01'),
};

export const mockDebtData = {
  id: 'debt-1',
  userId: 'user-1',
  name: 'Credit Card',
  kind: 'card' as const,
  principal: 5000.00,
  interestRateAnnual: 18.5,
  minPaymentAmount: 150.00,
  startDate: new Date('2024-01-01'),
  dueDate: new Date('2026-01-01'),
  linkedAccountId: null,
  createdAt: new Date('2024-01-01'),
};

// Utility functions for setting up mock responses
export const setupMockPrismaForAuth = (mockPrisma: MockPrismaService) => {
  mockPrisma.user.findUnique.mockResolvedValue(mockUserData);
  mockPrisma.user.create.mockResolvedValue(mockUserData);
  mockPrisma.category.create.mockResolvedValue(mockCategoryData);
};

export const setupMockPrismaForAccounts = (mockPrisma: MockPrismaService) => {
  mockPrisma.account.findFirst.mockResolvedValue(mockAccountData);
  mockPrisma.account.findMany.mockResolvedValue([mockAccountData]);
  mockPrisma.account.create.mockResolvedValue(mockAccountData);
  mockPrisma.account.update.mockResolvedValue(mockAccountData);
  mockPrisma.account.count.mockResolvedValue(1);
};

export const setupMockPrismaForTransactions = (mockPrisma: MockPrismaService) => {
  mockPrisma.transaction.findFirst.mockResolvedValue(mockTransactionData);
  mockPrisma.transaction.findMany.mockResolvedValue([mockTransactionData]);
  mockPrisma.transaction.create.mockResolvedValue(mockTransactionData);
  mockPrisma.transaction.update.mockResolvedValue(mockTransactionData);
  mockPrisma.transaction.count.mockResolvedValue(1);
  mockPrisma.account.findFirst.mockResolvedValue(mockAccountData);
  mockPrisma.category.findFirst.mockResolvedValue(mockCategoryData);
};

export const resetAllMocks = (mockPrisma: MockPrismaService) => {
  Object.values(mockPrisma).forEach((mockModel) => {
    if (typeof mockModel === 'object' && mockModel !== null) {
      Object.values(mockModel).forEach((mockMethod) => {
        if (typeof mockMethod === 'function') {
          mockMethod.mockReset();
        }
      });
    }
  });
};