import { Test, TestingModule } from '@nestjs/testing';
import { AccountsService } from './accounts.service';
import { PrismaService } from '../../services/prisma.service';
import { NotFoundError, ValidationError, ForbiddenError } from '../../common/exceptions/graphql-error.exception';
import { AccountType, TransactionType, TransactionSource } from '@finnit/database';
import { PaginationUtil } from '../../common/utils/pagination.util';

describe('AccountsService', () => {
  let service: AccountsService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockUserId = 'user-1';
  const mockAccount = {
    id: 'account-1',
    userId: mockUserId,
    type: AccountType.cash,
    name: 'Test Account',
    currency: 'USD',
    balanceCurrent: 1000.00,
    metadata: { test: 'data' },
    archived: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(async () => {
    const mockPrismaService = {
      account: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      transaction: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AccountsService>(AccountsService);
    prismaService = module.get(PrismaService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    const createInput = {
      type: AccountType.cash,
      name: 'New Account',
      currency: 'USD',
      initialBalance: 500.00,
      metadata: { test: 'metadata' },
    };

    it('should successfully create an account with initial balance', async () => {
      // Arrange
      const expectedAccount = { ...mockAccount, ...createInput };
      prismaService.account.create.mockResolvedValue(expectedAccount);
      prismaService.transaction.create.mockResolvedValue({} as any);

      // Act
      const result = await service.create(mockUserId, createInput);

      // Assert
      expect(prismaService.account.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          type: createInput.type,
          name: createInput.name,
          currency: createInput.currency,
          balanceCurrent: createInput.initialBalance,
          metadata: createInput.metadata,
        },
      });

      expect(prismaService.transaction.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          accountId: expectedAccount.id,
          type: TransactionType.income,
          amount: Math.abs(createInput.initialBalance),
          currency: createInput.currency,
          txnDate: expect.any(Date),
          description: 'Initial balance',
          source: TransactionSource.manual,
        },
      });

      expect(result).toEqual({
        id: expectedAccount.id,
        userId: expectedAccount.userId,
        type: expectedAccount.type,
        name: expectedAccount.name,
        currency: expectedAccount.currency,
        balanceCurrent: Number(expectedAccount.balanceCurrent),
        metadata: expectedAccount.metadata,
        archived: expectedAccount.archived,
        createdAt: expectedAccount.createdAt,
        updatedAt: expectedAccount.updatedAt,
      });
    });

    it('should create account without initial transaction when balance is zero', async () => {
      // Arrange
      const zeroBalanceInput = { ...createInput, initialBalance: 0 };
      const expectedAccount = { ...mockAccount, ...zeroBalanceInput, balanceCurrent: 0 };
      prismaService.account.create.mockResolvedValue(expectedAccount);

      // Act
      await service.create(mockUserId, zeroBalanceInput);

      // Assert
      expect(prismaService.account.create).toHaveBeenCalled();
      expect(prismaService.transaction.create).not.toHaveBeenCalled();
    });

    it('should create expense transaction for negative initial balance', async () => {
      // Arrange
      const negativeBalanceInput = { ...createInput, initialBalance: -200.00 };
      const expectedAccount = { ...mockAccount, ...negativeBalanceInput };
      prismaService.account.create.mockResolvedValue(expectedAccount);
      prismaService.transaction.create.mockResolvedValue({} as any);

      // Act
      await service.create(mockUserId, negativeBalanceInput);

      // Assert
      expect(prismaService.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: TransactionType.expense,
          amount: 200.00, // Math.abs of negative balance
        }),
      });
    });

    it('should handle account creation errors', async () => {
      // Arrange
      prismaService.account.create.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(service.create(mockUserId, createInput)).rejects.toThrow('Database error');
    });
  });

  describe('findMany', () => {
    const mockAccounts = [mockAccount, { ...mockAccount, id: 'account-2' }];

    it('should return paginated accounts with default parameters', async () => {
      // Arrange
      const args = {};
      prismaService.account.findMany.mockResolvedValue(mockAccounts);
      prismaService.account.count.mockResolvedValue(2);

      jest.spyOn(PaginationUtil, 'createConnection').mockReturnValue({
        edges: mockAccounts.map(acc => ({ node: service['mapAccount'](acc), cursor: 'cursor' })),
        pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null },
        totalCount: 2,
      });

      // Act
      const result = await service.findMany(mockUserId, args);

      // Assert
      expect(prismaService.account.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        take: 20,
        orderBy: { createdAt: 'desc' },
      });
      expect(result.totalCount).toBe(2);
    });

    it('should filter accounts by type', async () => {
      // Arrange
      const args = { type: AccountType.savings };
      prismaService.account.findMany.mockResolvedValue([mockAccount]);
      prismaService.account.count.mockResolvedValue(1);

      jest.spyOn(PaginationUtil, 'createConnection').mockReturnValue({
        edges: [],
        pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null },
        totalCount: 1,
      });

      // Act
      await service.findMany(mockUserId, args);

      // Assert
      expect(prismaService.account.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId, type: AccountType.savings },
        take: 20,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter accounts by archived status', async () => {
      // Arrange
      const args = { archived: true };
      prismaService.account.findMany.mockResolvedValue([]);
      prismaService.account.count.mockResolvedValue(0);

      jest.spyOn(PaginationUtil, 'createConnection').mockReturnValue({
        edges: [],
        pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null },
        totalCount: 0,
      });

      // Act
      await service.findMany(mockUserId, args);

      // Assert
      expect(prismaService.account.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId, archived: true },
        take: 20,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should handle cursor pagination with after parameter', async () => {
      // Arrange
      const args = { after: 'cursor-123', first: 10 };
      prismaService.account.findMany.mockResolvedValue([mockAccount]);
      prismaService.account.count.mockResolvedValue(1);

      jest.spyOn(PaginationUtil, 'decodeCursor').mockReturnValue('cursor-123');
      jest.spyOn(PaginationUtil, 'createConnection').mockReturnValue({
        edges: [],
        pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null },
        totalCount: 1,
      });

      // Act
      await service.findMany(mockUserId, args);

      // Assert
      expect(prismaService.account.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId, id: { gt: 'cursor-123' } },
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should handle cursor pagination with before parameter', async () => {
      // Arrange
      const args = { before: 'cursor-456', last: 5 };
      prismaService.account.findMany.mockResolvedValue([mockAccount]);
      prismaService.account.count.mockResolvedValue(1);

      jest.spyOn(PaginationUtil, 'decodeCursor').mockReturnValue('cursor-456');
      jest.spyOn(PaginationUtil, 'createConnection').mockReturnValue({
        edges: [],
        pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null },
        totalCount: 1,
      });

      // Act
      await service.findMany(mockUserId, args);

      // Assert
      expect(prismaService.account.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId, id: { lt: 'cursor-456' } },
        take: 5,
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findById', () => {
    it('should return account when found', async () => {
      // Arrange
      prismaService.account.findFirst.mockResolvedValue(mockAccount);

      // Act
      const result = await service.findById(mockAccount.id, mockUserId);

      // Assert
      expect(prismaService.account.findFirst).toHaveBeenCalledWith({
        where: { id: mockAccount.id, userId: mockUserId },
      });
      expect(result).toEqual({
        id: mockAccount.id,
        userId: mockAccount.userId,
        type: mockAccount.type,
        name: mockAccount.name,
        currency: mockAccount.currency,
        balanceCurrent: Number(mockAccount.balanceCurrent),
        metadata: mockAccount.metadata,
        archived: mockAccount.archived,
        createdAt: mockAccount.createdAt,
        updatedAt: mockAccount.updatedAt,
      });
    });

    it('should throw NotFoundError when account not found', async () => {
      // Arrange
      prismaService.account.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findById('non-existent', mockUserId)).rejects.toThrow(NotFoundError);
    });

    it('should not return account from different user', async () => {
      // Arrange
      prismaService.account.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findById(mockAccount.id, 'different-user')).rejects.toThrow(NotFoundError);
    });
  });

  describe('update', () => {
    const updateInput = {
      name: 'Updated Account',
      metadata: { updated: true },
    };

    it('should successfully update account', async () => {
      // Arrange
      const updatedAccount = { ...mockAccount, ...updateInput };
      prismaService.account.findFirst.mockResolvedValue(mockAccount);
      prismaService.account.update.mockResolvedValue(updatedAccount);

      // Act
      const result = await service.update(mockAccount.id, mockUserId, updateInput);

      // Assert
      expect(prismaService.account.findFirst).toHaveBeenCalledWith({
        where: { id: mockAccount.id, userId: mockUserId },
      });
      expect(prismaService.account.update).toHaveBeenCalledWith({
        where: { id: mockAccount.id },
        data: updateInput,
      });
      expect(result.name).toBe(updateInput.name);
      expect(result.metadata).toEqual(updateInput.metadata);
    });

    it('should throw NotFoundError when account not found', async () => {
      // Arrange
      prismaService.account.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.update('non-existent', mockUserId, updateInput)).rejects.toThrow(NotFoundError);
      expect(prismaService.account.update).not.toHaveBeenCalled();
    });

    it('should handle update errors', async () => {
      // Arrange
      prismaService.account.findFirst.mockResolvedValue(mockAccount);
      prismaService.account.update.mockRejectedValue(new Error('Update failed'));

      // Act & Assert
      await expect(service.update(mockAccount.id, mockUserId, updateInput)).rejects.toThrow('Update failed');
    });
  });

  describe('adjustBalance', () => {
    const adjustInput = {
      accountId: mockAccount.id,
      amount: 100.00,
      description: 'Balance adjustment',
    };

    it('should successfully adjust account balance with positive amount', async () => {
      // Arrange
      const updatedAccount = { ...mockAccount, balanceCurrent: 1100.00 };
      prismaService.account.findFirst.mockResolvedValue(mockAccount);

      prismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          transaction: { create: jest.fn() },
          account: { 
            update: jest.fn().mockResolvedValue(updatedAccount) 
          },
        };
        return callback(mockTx);
      });

      // Act
      const result = await service.adjustBalance(mockUserId, adjustInput);

      // Assert
      expect(prismaService.account.findFirst).toHaveBeenCalledWith({
        where: { id: adjustInput.accountId, userId: mockUserId },
      });
      expect(result.balanceCurrent).toBe(1100.00);
    });

    it('should successfully adjust account balance with negative amount', async () => {
      // Arrange
      const negativeAdjustInput = { ...adjustInput, amount: -50.00 };
      const updatedAccount = { ...mockAccount, balanceCurrent: 950.00 };
      prismaService.account.findFirst.mockResolvedValue(mockAccount);

      prismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          transaction: { create: jest.fn() },
          account: { 
            update: jest.fn().mockResolvedValue(updatedAccount) 
          },
        };
        return callback(mockTx);
      });

      // Act
      const result = await service.adjustBalance(mockUserId, negativeAdjustInput);

      // Assert
      expect(result.balanceCurrent).toBe(950.00);
    });

    it('should throw ValidationError for zero adjustment amount', async () => {
      // Arrange
      const zeroAdjustInput = { ...adjustInput, amount: 0 };
      prismaService.account.findFirst.mockResolvedValue(mockAccount);

      // Act & Assert
      await expect(service.adjustBalance(mockUserId, zeroAdjustInput)).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when account not found', async () => {
      // Arrange
      prismaService.account.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.adjustBalance(mockUserId, adjustInput)).rejects.toThrow(NotFoundError);
    });

    it('should create adjustment transaction with correct data', async () => {
      // Arrange
      const updatedAccount = { ...mockAccount, balanceCurrent: 1100.00 };
      prismaService.account.findFirst.mockResolvedValue(mockAccount);

      let capturedTransactionData: any;
      prismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          transaction: { 
            create: jest.fn().mockImplementation((data) => {
              capturedTransactionData = data;
            })
          },
          account: { 
            update: jest.fn().mockResolvedValue(updatedAccount) 
          },
        };
        return callback(mockTx);
      });

      // Act
      await service.adjustBalance(mockUserId, adjustInput);

      // Assert
      expect(capturedTransactionData).toEqual({
        data: {
          userId: mockUserId,
          accountId: mockAccount.id,
          type: TransactionType.adjustment,
          amount: Math.abs(adjustInput.amount),
          currency: mockAccount.currency,
          txnDate: expect.any(Date),
          description: adjustInput.description,
          source: TransactionSource.manual,
        },
      });
    });

    it('should handle transaction failures', async () => {
      // Arrange
      prismaService.account.findFirst.mockResolvedValue(mockAccount);
      prismaService.$transaction.mockRejectedValue(new Error('Transaction failed'));

      // Act & Assert
      await expect(service.adjustBalance(mockUserId, adjustInput)).rejects.toThrow('Transaction failed');
    });
  });

  describe('delete', () => {
    it('should successfully delete account without transactions', async () => {
      // Arrange
      const accountWithoutTransactions = { ...mockAccount, transactions: [] };
      prismaService.account.findFirst.mockResolvedValue(accountWithoutTransactions);
      prismaService.account.delete.mockResolvedValue(mockAccount);

      // Act
      const result = await service.delete(mockAccount.id, mockUserId);

      // Assert
      expect(prismaService.account.findFirst).toHaveBeenCalledWith({
        where: { id: mockAccount.id, userId: mockUserId },
        include: { transactions: true },
      });
      expect(prismaService.account.delete).toHaveBeenCalledWith({
        where: { id: mockAccount.id },
      });
      expect(result).toBe(true);
    });

    it('should throw ValidationError when account has transactions', async () => {
      // Arrange
      const accountWithTransactions = { 
        ...mockAccount, 
        transactions: [{ id: 'txn-1' }] as any 
      };
      prismaService.account.findFirst.mockResolvedValue(accountWithTransactions);

      // Act & Assert
      await expect(service.delete(mockAccount.id, mockUserId)).rejects.toThrow(ValidationError);
      expect(prismaService.account.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError when account not found', async () => {
      // Arrange
      prismaService.account.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.delete('non-existent', mockUserId)).rejects.toThrow(NotFoundError);
      expect(prismaService.account.delete).not.toHaveBeenCalled();
    });

    it('should handle delete errors', async () => {
      // Arrange
      const accountWithoutTransactions = { ...mockAccount, transactions: [] };
      prismaService.account.findFirst.mockResolvedValue(accountWithoutTransactions);
      prismaService.account.delete.mockRejectedValue(new Error('Delete failed'));

      // Act & Assert
      await expect(service.delete(mockAccount.id, mockUserId)).rejects.toThrow('Delete failed');
    });
  });

  describe('mapAccount', () => {
    it('should correctly map account with all fields', () => {
      // Act
      const result = service['mapAccount'](mockAccount);

      // Assert
      expect(result).toEqual({
        id: mockAccount.id,
        userId: mockAccount.userId,
        type: mockAccount.type,
        name: mockAccount.name,
        currency: mockAccount.currency,
        balanceCurrent: Number(mockAccount.balanceCurrent),
        metadata: mockAccount.metadata,
        archived: mockAccount.archived,
        createdAt: mockAccount.createdAt,
        updatedAt: mockAccount.updatedAt,
      });
    });

    it('should handle null metadata', () => {
      // Arrange
      const accountWithoutMetadata = { ...mockAccount, metadata: null };

      // Act
      const result = service['mapAccount'](accountWithoutMetadata);

      // Assert
      expect(result.metadata).toBeNull();
    });

    it('should correctly convert Decimal balance to number', () => {
      // Arrange
      const accountWithDecimal = { 
        ...mockAccount, 
        balanceCurrent: { toString: () => '1234.56' } as any 
      };

      // Act
      const result = service['mapAccount'](accountWithDecimal);

      // Assert
      expect(result.balanceCurrent).toBe(1234.56);
      expect(typeof result.balanceCurrent).toBe('number');
    });
  });

  describe('edge cases and error scenarios', () => {
    it('should handle very large balance adjustments', async () => {
      // Arrange
      const largeAdjustInput = {
        accountId: mockAccount.id,
        amount: 999999999.99,
        description: 'Large adjustment',
      };
      const updatedAccount = { ...mockAccount, balanceCurrent: 1000999999.99 };
      prismaService.account.findFirst.mockResolvedValue(mockAccount);

      prismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          transaction: { create: jest.fn() },
          account: { update: jest.fn().mockResolvedValue(updatedAccount) },
        };
        return callback(mockTx);
      });

      // Act
      const result = await service.adjustBalance(mockUserId, largeAdjustInput);

      // Assert
      expect(result.balanceCurrent).toBe(1000999999.99);
    });

    it('should handle concurrent balance adjustments', async () => {
      // Arrange
      prismaService.account.findFirst.mockResolvedValue(mockAccount);
      prismaService.$transaction.mockRejectedValue(new Error('Concurrent modification'));

      // Act & Assert
      await expect(service.adjustBalance(mockUserId, {
        accountId: mockAccount.id,
        amount: 100.00,
        description: 'Concurrent test',
      })).rejects.toThrow('Concurrent modification');
    });

    it('should handle invalid currency codes in creation', async () => {
      // This would be handled by validation at the GraphQL layer
      // but we can test the service behavior
      const invalidCurrencyInput = {
        type: AccountType.cash,
        name: 'Test Account',
        currency: 'INVALID',
        initialBalance: 100.00,
      };

      prismaService.account.create.mockRejectedValue(new Error('Invalid currency'));

      await expect(service.create(mockUserId, invalidCurrencyInput)).rejects.toThrow('Invalid currency');
    });
  });
});