import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsService } from './transactions.service';
import { PrismaService } from '../../services/prisma.service';
import { NotFoundError, ValidationError } from '../../common/exceptions/graphql-error.exception';
import { TransactionType, TransactionSource } from '@finnit/database';
import { PaginationUtil } from '../../common/utils/pagination.util';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockUserId = 'user-1';
  const mockAccountId = 'account-1';
  const mockCategoryId = 'category-1';

  const mockAccount = {
    id: mockAccountId,
    userId: mockUserId,
    type: 'cash',
    name: 'Test Account',
    currency: 'USD',
    balanceCurrent: 1000.00,
  };

  const mockCategory = {
    id: mockCategoryId,
    userId: mockUserId,
    name: 'Test Category',
    isDefault: false,
  };

  const mockTransaction = {
    id: 'transaction-1',
    userId: mockUserId,
    accountId: mockAccountId,
    categoryId: mockCategoryId,
    type: TransactionType.expense,
    amount: 100.00,
    currency: 'USD',
    txnDate: new Date('2024-01-01'),
    description: 'Test transaction',
    merchantName: 'Test Merchant',
    isPending: false,
    isRecurringInstance: false,
    source: TransactionSource.manual,
    externalId: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    attachments: [],
  };

  beforeEach(async () => {
    const mockPrismaService = {
      account: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      category: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      transaction: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn(),
      },
      attachment: {
        create: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    prismaService = module.get(PrismaService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    const createInput = {
      accountId: mockAccountId,
      categoryId: mockCategoryId,
      type: TransactionType.expense,
      amount: 50.00,
      currency: 'USD',
      txnDate: new Date('2024-01-01'),
      description: 'Test expense',
      merchantName: 'Test Store',
      isPending: false,
    };

    it('should successfully create a transaction with account balance update', async () => {
      // Arrange
      prismaService.account.findFirst.mockResolvedValue(mockAccount);
      prismaService.category.findFirst.mockResolvedValue(mockCategory);

      const createdTransaction = { ...mockTransaction, ...createInput };
      prismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          transaction: { create: jest.fn().mockResolvedValue(createdTransaction) },
          account: { update: jest.fn() },
        };
        const result = await callback(mockTx);
        return result;
      });

      // Act
      const result = await service.create(mockUserId, createInput);

      // Assert
      expect(prismaService.account.findFirst).toHaveBeenCalledWith({
        where: { id: mockAccountId, userId: mockUserId },
      });
      expect(prismaService.category.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockCategoryId,
          OR: [
            { userId: mockUserId },
            { userId: null, isDefault: true },
          ],
        },
      });
      expect(result).toEqual(expect.objectContaining({
        id: createdTransaction.id,
        type: createdTransaction.type,
        amount: Number(createdTransaction.amount),
      }));
    });

    it('should create transaction without category when not provided', async () => {
      // Arrange
      const inputWithoutCategory = { ...createInput };
      delete inputWithoutCategory.categoryId;
      delete inputWithoutCategory.merchantName;

      prismaService.account.findFirst.mockResolvedValue(mockAccount);
      const createdTransaction = { ...mockTransaction, categoryId: null };
      
      prismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          transaction: { create: jest.fn().mockResolvedValue(createdTransaction) },
          account: { update: jest.fn() },
        };
        return callback(mockTx);
      });

      // Act
      await service.create(mockUserId, inputWithoutCategory);

      // Assert
      expect(prismaService.category.findFirst).not.toHaveBeenCalled();
    });

    it('should auto-categorize transaction based on merchant name', async () => {
      // Arrange
      const inputWithoutCategory = { ...createInput };
      delete inputWithoutCategory.categoryId;

      const suggestedCategory = { id: 'suggested-category', name: 'Suggested' };
      prismaService.account.findFirst.mockResolvedValue(mockAccount);
      
      // Mock the suggestCategoryForMerchant method
      jest.spyOn(service as any, 'suggestCategoryForMerchant').mockResolvedValue(suggestedCategory);
      prismaService.category.findFirst.mockResolvedValue(suggestedCategory);

      const createdTransaction = { ...mockTransaction, categoryId: suggestedCategory.id };
      prismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          transaction: { create: jest.fn().mockResolvedValue(createdTransaction) },
          account: { update: jest.fn() },
        };
        return callback(mockTx);
      });

      // Act
      await service.create(mockUserId, inputWithoutCategory);

      // Assert
      expect(service['suggestCategoryForMerchant']).toHaveBeenCalledWith(
        mockUserId,
        inputWithoutCategory.merchantName
      );
    });

    it('should throw NotFoundError when account not found', async () => {
      // Arrange
      prismaService.account.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.create(mockUserId, createInput)).rejects.toThrow(NotFoundError);
      expect(prismaService.$transaction).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError when category not found', async () => {
      // Arrange
      prismaService.account.findFirst.mockResolvedValue(mockAccount);
      prismaService.category.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.create(mockUserId, createInput)).rejects.toThrow(NotFoundError);
      expect(prismaService.$transaction).not.toHaveBeenCalled();
    });

    it('should handle income transaction with positive balance change', async () => {
      // Arrange
      const incomeInput = { ...createInput, type: TransactionType.income };
      prismaService.account.findFirst.mockResolvedValue(mockAccount);
      prismaService.category.findFirst.mockResolvedValue(mockCategory);

      let capturedBalanceChange: number | undefined;
      prismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          transaction: { create: jest.fn().mockResolvedValue({ ...mockTransaction, type: TransactionType.income }) },
          account: { 
            update: jest.fn().mockImplementation((data) => {
              capturedBalanceChange = data.data.balanceCurrent.increment;
            })
          },
        };
        return callback(mockTx);
      });

      // Act
      await service.create(mockUserId, incomeInput);

      // Assert
      expect(capturedBalanceChange).toBe(incomeInput.amount); // Positive for income
    });

    it('should handle expense transaction with negative balance change', async () => {
      // Arrange
      prismaService.account.findFirst.mockResolvedValue(mockAccount);
      prismaService.category.findFirst.mockResolvedValue(mockCategory);

      let capturedBalanceChange: number | undefined;
      prismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          transaction: { create: jest.fn().mockResolvedValue(mockTransaction) },
          account: { 
            update: jest.fn().mockImplementation((data) => {
              capturedBalanceChange = data.data.balanceCurrent.increment;
            })
          },
        };
        return callback(mockTx);
      });

      // Act
      await service.create(mockUserId, createInput);

      // Assert
      expect(capturedBalanceChange).toBe(-createInput.amount); // Negative for expense
    });

    it('should not update balance for pending transactions', async () => {
      // Arrange
      const pendingInput = { ...createInput, isPending: true };
      prismaService.account.findFirst.mockResolvedValue(mockAccount);
      prismaService.category.findFirst.mockResolvedValue(mockCategory);

      const pendingTransaction = { ...mockTransaction, isPending: true };
      let accountUpdateCalled = false;

      prismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          transaction: { create: jest.fn().mockResolvedValue(pendingTransaction) },
          account: { 
            update: jest.fn().mockImplementation(() => {
              accountUpdateCalled = true;
            })
          },
        };
        return callback(mockTx);
      });

      // Act
      await service.create(mockUserId, pendingInput);

      // Assert
      expect(accountUpdateCalled).toBe(false);
    });
  });

  describe('findMany', () => {
    const mockTransactions = [mockTransaction, { ...mockTransaction, id: 'transaction-2' }];

    it('should return paginated transactions', async () => {
      // Arrange
      const args = { first: 10 };
      prismaService.transaction.findMany.mockResolvedValue(mockTransactions);
      prismaService.transaction.count.mockResolvedValue(2);

      jest.spyOn(PaginationUtil, 'createConnection').mockReturnValue({
        edges: mockTransactions.map(txn => ({ node: service['mapTransaction'](txn), cursor: 'cursor' })),
        pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null },
        totalCount: 2,
      });

      // Act
      const result = await service.findMany(mockUserId, args);

      // Assert
      expect(prismaService.transaction.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        take: 10,
        orderBy: { txnDate: 'desc' },
      });
      expect(result.totalCount).toBe(2);
    });

    it('should apply filters when provided', async () => {
      // Arrange
      const args = {
        first: 10,
        filters: {
          accountId: mockAccountId,
          type: TransactionType.expense,
          categoryId: mockCategoryId,
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-31'),
          merchantName: 'Test Store',
          minAmount: 50,
          maxAmount: 200,
        },
      };

      prismaService.transaction.findMany.mockResolvedValue([mockTransaction]);
      prismaService.transaction.count.mockResolvedValue(1);

      jest.spyOn(service as any, 'applyFilters').mockImplementation((where, filters) => {
        Object.assign(where, filters);
      });

      jest.spyOn(PaginationUtil, 'createConnection').mockReturnValue({
        edges: [],
        pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null },
        totalCount: 1,
      });

      // Act
      await service.findMany(mockUserId, args);

      // Assert
      expect(service['applyFilters']).toHaveBeenCalledWith(
        { userId: mockUserId },
        args.filters
      );
    });

    it('should handle cursor pagination', async () => {
      // Arrange
      const args = { after: 'cursor-123', first: 5 };
      prismaService.transaction.findMany.mockResolvedValue([mockTransaction]);
      prismaService.transaction.count.mockResolvedValue(1);

      jest.spyOn(PaginationUtil, 'decodeCursor').mockReturnValue('cursor-123');
      jest.spyOn(PaginationUtil, 'createConnection').mockReturnValue({
        edges: [],
        pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null },
        totalCount: 1,
      });

      // Act
      await service.findMany(mockUserId, args);

      // Assert
      expect(prismaService.transaction.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId, id: { gt: 'cursor-123' } },
        take: 5,
        orderBy: { txnDate: 'desc' },
      });
    });
  });

  describe('findById', () => {
    it('should return transaction when found', async () => {
      // Arrange
      const transactionWithAttachments = {
        ...mockTransaction,
        attachments: [
          {
            id: 'attachment-1',
            fileUrl: 'https://example.com/file.pdf',
            fileType: 'pdf',
            fileSize: 1024,
          },
        ],
      };
      prismaService.transaction.findFirst.mockResolvedValue(transactionWithAttachments);

      // Act
      const result = await service.findById(mockTransaction.id, mockUserId);

      // Assert
      expect(prismaService.transaction.findFirst).toHaveBeenCalledWith({
        where: { id: mockTransaction.id, userId: mockUserId },
        include: { attachments: true },
      });
      expect(result.id).toBe(mockTransaction.id);
    });

    it('should throw NotFoundError when transaction not found', async () => {
      // Arrange
      prismaService.transaction.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findById('non-existent', mockUserId)).rejects.toThrow(NotFoundError);
    });
  });

  describe('update', () => {
    const updateInput = {
      description: 'Updated description',
      merchantName: 'Updated Merchant',
      categoryId: 'new-category-id',
    };

    it('should successfully update manual transaction', async () => {
      // Arrange
      const manualTransaction = { ...mockTransaction, source: TransactionSource.manual };
      const updatedTransaction = { ...manualTransaction, ...updateInput };
      
      prismaService.transaction.findFirst.mockResolvedValue(manualTransaction);
      prismaService.category.findFirst.mockResolvedValue({ id: 'new-category-id' });

      prismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          transaction: { update: jest.fn().mockResolvedValue(updatedTransaction) },
          account: { update: jest.fn() },
        };
        return callback(mockTx);
      });

      // Act
      const result = await service.update(mockTransaction.id, mockUserId, updateInput);

      // Assert
      expect(result.description).toBe(updateInput.description);
      expect(result.merchantName).toBe(updateInput.merchantName);
    });

    it('should throw ValidationError for imported transactions', async () => {
      // Arrange
      const importedTransaction = { ...mockTransaction, source: TransactionSource.imported };
      prismaService.transaction.findFirst.mockResolvedValue(importedTransaction);

      // Act & Assert
      await expect(service.update(mockTransaction.id, mockUserId, updateInput)).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when transaction not found', async () => {
      // Arrange
      prismaService.transaction.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.update('non-existent', mockUserId, updateInput)).rejects.toThrow(NotFoundError);
    });

    it('should handle amount updates with balance recalculation', async () => {
      // Arrange
      const amountUpdateInput = { ...updateInput, amount: 150.00 };
      const manualTransaction = { ...mockTransaction, source: TransactionSource.manual };
      const updatedTransaction = { ...manualTransaction, amount: 150.00 };
      
      prismaService.transaction.findFirst.mockResolvedValue(manualTransaction);
      prismaService.category.findFirst.mockResolvedValue({ id: 'new-category-id' });

      let balanceAdjustment: number | undefined;
      prismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          transaction: { update: jest.fn().mockResolvedValue(updatedTransaction) },
          account: { 
            update: jest.fn().mockImplementation((data) => {
              balanceAdjustment = data.data.balanceCurrent.increment;
            })
          },
        };
        return callback(mockTx);
      });

      // Act
      await service.update(mockTransaction.id, mockUserId, amountUpdateInput);

      // Assert
      // Original amount was 100, new amount is 150, difference is 50
      // For expense transaction, balance should decrease by 50 more (negative)
      expect(balanceAdjustment).toBe(-50);
    });
  });

  describe('delete', () => {
    it('should successfully delete manual transaction with balance adjustment', async () => {
      // Arrange
      const manualTransaction = { ...mockTransaction, source: TransactionSource.manual };
      prismaService.transaction.findFirst.mockResolvedValue(manualTransaction);

      prismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          transaction: { delete: jest.fn() },
          account: { update: jest.fn() },
        };
        return callback(mockTx);
      });

      // Act
      const result = await service.delete(mockTransaction.id, mockUserId);

      // Assert
      expect(result).toBe(true);
    });

    it('should throw ValidationError for imported transactions', async () => {
      // Arrange
      const importedTransaction = { ...mockTransaction, source: TransactionSource.imported };
      prismaService.transaction.findFirst.mockResolvedValue(importedTransaction);

      // Act & Assert
      await expect(service.delete(mockTransaction.id, mockUserId)).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when transaction not found', async () => {
      // Arrange
      prismaService.transaction.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.delete('non-existent', mockUserId)).rejects.toThrow(NotFoundError);
    });

    it('should reverse balance change when deleting transaction', async () => {
      // Arrange
      const expenseTransaction = { 
        ...mockTransaction, 
        type: TransactionType.expense,
        amount: 100.00,
        source: TransactionSource.manual,
        isPending: false,
      };
      
      prismaService.transaction.findFirst.mockResolvedValue(expenseTransaction);

      let balanceAdjustment: number | undefined;
      prismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          transaction: { delete: jest.fn() },
          account: { 
            update: jest.fn().mockImplementation((data) => {
              balanceAdjustment = data.data.balanceCurrent.increment;
            })
          },
        };
        return callback(mockTx);
      });

      // Act
      await service.delete(mockTransaction.id, mockUserId);

      // Assert
      // Deleting expense should add back the amount to balance (positive)
      expect(balanceAdjustment).toBe(100.00);
    });

    it('should not adjust balance for pending transactions', async () => {
      // Arrange
      const pendingTransaction = { 
        ...mockTransaction, 
        source: TransactionSource.manual,
        isPending: true,
      };
      
      prismaService.transaction.findFirst.mockResolvedValue(pendingTransaction);

      let accountUpdateCalled = false;
      prismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          transaction: { delete: jest.fn() },
          account: { 
            update: jest.fn().mockImplementation(() => {
              accountUpdateCalled = true;
            })
          },
        };
        return callback(mockTx);
      });

      // Act
      await service.delete(mockTransaction.id, mockUserId);

      // Assert
      expect(accountUpdateCalled).toBe(false);
    });
  });

  describe('mapTransaction', () => {
    it('should correctly map transaction with all fields', () => {
      // Act
      const result = service['mapTransaction'](mockTransaction);

      // Assert
      expect(result).toEqual({
        id: mockTransaction.id,
        userId: mockTransaction.userId,
        accountId: mockTransaction.accountId,
        categoryId: mockTransaction.categoryId,
        type: mockTransaction.type,
        amount: Number(mockTransaction.amount),
        currency: mockTransaction.currency,
        txnDate: mockTransaction.txnDate,
        description: mockTransaction.description,
        merchantName: mockTransaction.merchantName,
        isPending: mockTransaction.isPending,
        isRecurringInstance: mockTransaction.isRecurringInstance,
        source: mockTransaction.source,
        externalId: mockTransaction.externalId,
        createdAt: mockTransaction.createdAt,
        updatedAt: mockTransaction.updatedAt,
        attachments: [],
      });
    });

    it('should handle transaction with attachments', () => {
      // Arrange
      const transactionWithAttachments = {
        ...mockTransaction,
        attachments: [
          {
            id: 'attachment-1',
            transactionId: mockTransaction.id,
            fileUrl: 'https://example.com/receipt.jpg',
            fileType: 'image/jpeg',
            fileSize: 2048,
            extra: { metadata: 'test' },
            uploadedAt: new Date('2024-01-01'),
          },
        ],
      };

      // Act
      const result = service['mapTransaction'](transactionWithAttachments);

      // Assert
      expect(result.attachments).toHaveLength(1);
      expect(result.attachments[0]).toEqual({
        id: 'attachment-1',
        transactionId: mockTransaction.id,
        fileUrl: 'https://example.com/receipt.jpg',
        fileType: 'image/jpeg',
        fileSize: 2048,
        extra: { metadata: 'test' },
        uploadedAt: new Date('2024-01-01'),
      });
    });
  });

  describe('suggestCategoryForMerchant', () => {
    it('should return suggested category based on merchant history', async () => {
      // Arrange
      const merchantName = 'Starbucks';
      const suggestedCategory = { id: 'food-category', name: 'Food & Dining' };
      
      prismaService.transaction.findFirst.mockResolvedValue({
        categoryId: suggestedCategory.id,
        category: suggestedCategory,
      } as any);

      // Act
      const result = await service['suggestCategoryForMerchant'](mockUserId, merchantName);

      // Assert
      expect(prismaService.transaction.findFirst).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          merchantName: { contains: merchantName, mode: 'insensitive' },
          categoryId: { not: null },
        },
        include: { category: true },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(suggestedCategory);
    });

    it('should return null when no similar merchant found', async () => {
      // Arrange
      prismaService.transaction.findFirst.mockResolvedValue(null);

      // Act
      const result = await service['suggestCategoryForMerchant'](mockUserId, 'Unknown Merchant');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle very large transaction amounts', async () => {
      // Arrange
      const largeAmountInput = {
        ...mockTransaction,
        amount: 999999999.99,
      };

      prismaService.account.findFirst.mockResolvedValue(mockAccount);
      prismaService.category.findFirst.mockResolvedValue(mockCategory);

      prismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          transaction: { create: jest.fn().mockResolvedValue(largeAmountInput) },
          account: { update: jest.fn() },
        };
        return callback(mockTx);
      });

      // Act
      const result = await service.create(mockUserId, {
        accountId: mockAccountId,
        type: TransactionType.expense,
        amount: 999999999.99,
        currency: 'USD',
        txnDate: new Date(),
      });

      // Assert
      expect(result.amount).toBe(999999999.99);
    });

    it('should handle concurrent transaction creation', async () => {
      // Arrange
      prismaService.account.findFirst.mockResolvedValue(mockAccount);
      prismaService.$transaction.mockRejectedValue(new Error('Transaction conflict'));

      // Act & Assert
      await expect(service.create(mockUserId, {
        accountId: mockAccountId,
        type: TransactionType.expense,
        amount: 100.00,
        currency: 'USD',
        txnDate: new Date(),
      })).rejects.toThrow('Transaction conflict');
    });

    it('should validate category belongs to user or is default', async () => {
      // Arrange
      const globalDefaultCategory = {
        id: 'global-category',
        userId: null,
        isDefault: true,
        name: 'Global Category',
      };

      prismaService.account.findFirst.mockResolvedValue(mockAccount);
      prismaService.category.findFirst.mockResolvedValue(globalDefaultCategory);

      prismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          transaction: { create: jest.fn().mockResolvedValue(mockTransaction) },
          account: { update: jest.fn() },
        };
        return callback(mockTx);
      });

      // Act
      await service.create(mockUserId, {
        accountId: mockAccountId,
        categoryId: globalDefaultCategory.id,
        type: TransactionType.expense,
        amount: 100.00,
        currency: 'USD',
        txnDate: new Date(),
      });

      // Assert
      expect(prismaService.category.findFirst).toHaveBeenCalledWith({
        where: {
          id: globalDefaultCategory.id,
          OR: [
            { userId: mockUserId },
            { userId: null, isDefault: true },
          ],
        },
      });
    });
  });
});