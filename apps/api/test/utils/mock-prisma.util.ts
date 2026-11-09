import {
  Prisma,
  PrismaClient,
  type Account,
  type Category,
  type Transaction,
  type User,
} from '@finnit/database';
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

// Common mock data factories. Typed as the Prisma rows, so a schema change
// that adds a required column fails here instead of drifting silently.
export const mockUserData: User = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  passwordHash: 'hashed-password',
  role: 'user',
  isMaster: false,
  googleSubject: null,
  disabledAt: null,
  lastLoginAt: null,
  tokenVersion: 0,
  locale: 'es',
  googlePictureUrl: null,
  avatarKey: null,
  avatarUpdatedAt: null,
  privacyPinHash: null,
  privacyPinVersion: 0,
  privacyPinFailedAttempts: 0,
  privacyPinLockedUntil: null,
  invitedById: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

export const mockAccountData: Account = {
  id: 'account-1',
  userId: 'user-1',
  type: 'cash',
  name: 'Test Account',
  currency: 'USD',
  balanceCurrent: new Prisma.Decimal(1000),
  metadata: null,
  archived: false,
  isDefaultCash: false,
  includeInTotal: true,
  bankDifferenceTransactionId: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

export const mockTransactionData: Transaction = {
  id: 'transaction-1',
  userId: 'user-1',
  accountId: 'account-1',
  categoryId: 'category-1',
  type: 'expense',
  amount: new Prisma.Decimal(100),
  balanceEffect: new Prisma.Decimal(-100),
  currency: 'USD',
  txnDate: new Date('2024-01-01'),
  description: 'Test transaction',
  merchantName: null,
  notes: null,
  isPending: false,
  inProcess: false,
  isRecurringInstance: false,
  source: 'manual',
  externalId: null,
  aliasId: null,
  aliasName: null,
  isPrivate: false,
  categorySource: null,
  suggestedCategoryId: null,
  suggestedBy: null,
  originalType: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

export const mockCategoryData: Category = {
  id: 'category-1',
  userId: 'user-1',
  parentId: null,
  name: 'Food & Dining',
  key: null,
  isDefault: false,
  kind: 'expense',
  icon: null,
  color: null,
  sortOrder: 1,
  excludeFromTotals: false,
  createdAt: new Date('2024-01-01'),
};

export const mockBudgetData = {
  id: 'budget-1',
  userId: 'user-1',
  year: 2024,
  month: 1,
  currency: 'USD',
  amountTotal: 2000.0,
  createdAt: new Date('2024-01-01'),
};

export const mockGoalData = {
  id: 'goal-1',
  userId: 'user-1',
  name: 'Emergency Fund',
  targetAmount: 10000.0,
  currentAmount: 3000.0,
  currency: 'USD',
  dueDate: new Date('2024-12-31'),
  createdAt: new Date('2024-01-01'),
};

export const mockDebtData = {
  id: 'debt-1',
  userId: 'user-1',
  name: 'Credit Card',
  kind: 'card' as const,
  principal: 5000.0,
  interestRateAnnual: 18.5,
  minPaymentAmount: 150.0,
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

export const setupMockPrismaForTransactions = (
  mockPrisma: MockPrismaService,
) => {
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
          (mockMethod as jest.Mock).mockReset();
        }
      });
    }
  });
};
