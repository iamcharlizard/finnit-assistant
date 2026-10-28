import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { TransactionsService } from './transactions.service';
import { PrismaService } from '../../services/prisma.service';
import { S3StorageService } from '../storage/s3-storage.service';
import {
  NotFoundError,
  ValidationError,
} from '../../common/exceptions/graphql-error.exception';
import { TransactionType, TransactionSource } from '@finnit/database';
import { PaginationUtil } from '../../common/utils/pagination.util';
import { MerchantAliasesService } from '../categorization/merchant-aliases.service';
import { MerchantRulesService } from '../categorization/merchant-rules.service';
import {
  TRANSACTION_PRESENTATION_INCLUDE,
  mapTransaction,
} from './transaction.mapper';

/** Makes `$transaction(callback)` run the callback against `tx`. */
const runTransactionWith = (tx: unknown) =>
  ((callback: (client: unknown) => unknown) =>
    Promise.resolve(callback(tx))) as never;

/** The `data` argument of the n-th call to a mocked create/update. */
const dataOf = (fn: jest.Mock, call = 0) =>
  (fn.mock.calls[call] as [{ data: Record<string, unknown> }])[0].data;

describe('TransactionsService', () => {
  let service: TransactionsService;
  let prismaService: DeepMockProxy<PrismaService>;
  let storage: DeepMockProxy<S3StorageService>;
  let aliases: DeepMockProxy<MerchantAliasesService>;
  let rules: DeepMockProxy<MerchantRulesService>;

  const mockUserId = 'user-1';
  const mockAccountId = 'account-1';
  const mockCategoryId = 'category-1';

  const mockAccount = {
    id: mockAccountId,
    userId: mockUserId,
    type: 'cash',
    name: 'Test Account',
    currency: 'USD',
    balanceCurrent: 1000.0,
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
    amount: 100.0,
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
    prismaService = mockDeep<PrismaService>();
    storage = mockDeep<S3StorageService>();
    aliases = mockDeep<MerchantAliasesService>();
    rules = mockDeep<MerchantRulesService>();
    rules.categoryFor.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
        { provide: S3StorageService, useValue: storage },
        { provide: MerchantAliasesService, useValue: aliases },
        { provide: MerchantRulesService, useValue: rules },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    const createInput = {
      accountId: mockAccountId,
      categoryId: mockCategoryId,
      type: TransactionType.expense,
      amount: 50.0,
      currency: 'USD',
      txnDate: new Date('2024-01-01'),
      description: 'Test expense',
      merchantName: 'Test Store',
      isPending: false,
    };

    it('should successfully create a transaction with account balance update', async () => {
      // Arrange
      prismaService.account.findFirst.mockResolvedValue(mockAccount as any);
      prismaService.category.findFirst.mockResolvedValue(mockCategory as any);

      const createdTransaction = { ...mockTransaction, ...createInput };
      prismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          transaction: {
            create: jest.fn().mockResolvedValue(createdTransaction),
          },
          account: { update: jest.fn() },
        };
        const result = await callback(mockTx as any);
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
          OR: [{ userId: mockUserId }, { userId: null, isDefault: true }],
        },
      });
      expect(result).toEqual(
        expect.objectContaining({
          id: createdTransaction.id,
          type: createdTransaction.type,
          amount: Number(createdTransaction.amount),
        }),
      );
    });

    it('should create transaction without category when not provided', async () => {
      // Arrange
      const inputWithoutCategory: any = { ...createInput };
      delete inputWithoutCategory.categoryId;
      delete inputWithoutCategory.merchantName;

      prismaService.account.findFirst.mockResolvedValue(mockAccount as any);
      const createdTransaction = { ...mockTransaction, categoryId: null };

      prismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          transaction: {
            create: jest.fn().mockResolvedValue(createdTransaction),
          },
          account: { update: jest.fn() },
        };
        return callback(mockTx as any);
      });

      // Act
      await service.create(mockUserId, inputWithoutCategory);

      // Assert
      expect(prismaService.category.findFirst).not.toHaveBeenCalled();
    });

    it('should auto-categorize transaction based on merchant name', async () => {
      // Arrange
      const inputWithoutCategory: any = { ...createInput };
      delete inputWithoutCategory.categoryId;

      const suggestedCategory = { id: 'suggested-category', name: 'Suggested' };
      prismaService.account.findFirst.mockResolvedValue(mockAccount as any);

      // Mock the suggestCategoryForMerchant method
      jest
        .spyOn(service as any, 'suggestCategoryForMerchant')
        .mockResolvedValue(suggestedCategory);
      prismaService.category.findFirst.mockResolvedValue(
        suggestedCategory as any,
      );

      const createdTransaction = {
        ...mockTransaction,
        categoryId: suggestedCategory.id,
      };
      prismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          transaction: {
            create: jest.fn().mockResolvedValue(createdTransaction),
          },
          account: { update: jest.fn() },
        };
        return callback(mockTx as any);
      });

      // Act
      await service.create(mockUserId, inputWithoutCategory);

      // Assert
      expect(service['suggestCategoryForMerchant']).toHaveBeenCalledWith(
        mockUserId,
        inputWithoutCategory.merchantName,
      );
    });

    it('should throw NotFoundError when account not found', async () => {
      // Arrange
      prismaService.account.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.create(mockUserId, createInput)).rejects.toThrow(
        NotFoundError,
      );
      expect(prismaService.$transaction).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError when category not found', async () => {
      // Arrange
      prismaService.account.findFirst.mockResolvedValue(mockAccount as any);
      prismaService.category.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.create(mockUserId, createInput)).rejects.toThrow(
        NotFoundError,
      );
      expect(prismaService.$transaction).not.toHaveBeenCalled();
    });

    it('should handle income transaction with positive balance change', async () => {
      // Arrange
      const incomeInput = { ...createInput, type: TransactionType.income };
      prismaService.account.findFirst.mockResolvedValue(mockAccount as any);
      prismaService.category.findFirst.mockResolvedValue(mockCategory as any);

      let capturedBalanceChange: number | undefined;
      prismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          transaction: {
            create: jest.fn().mockResolvedValue({
              ...mockTransaction,
              type: TransactionType.income,
            }),
          },
          account: {
            update: jest.fn().mockImplementation((data) => {
              capturedBalanceChange = data.data.balanceCurrent.increment;
            }),
          },
        };
        return callback(mockTx as any);
      });

      // Act
      await service.create(mockUserId, incomeInput);

      // Assert
      expect(capturedBalanceChange).toBe(incomeInput.amount); // Positive for income
    });

    it('should handle expense transaction with negative balance change', async () => {
      // Arrange
      prismaService.account.findFirst.mockResolvedValue(mockAccount as any);
      prismaService.category.findFirst.mockResolvedValue(mockCategory as any);

      let capturedBalanceChange: number | undefined;
      prismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          transaction: { create: jest.fn().mockResolvedValue(mockTransaction) },
          account: {
            update: jest.fn().mockImplementation((data) => {
              capturedBalanceChange = data.data.balanceCurrent.increment;
            }),
          },
        };
        return callback(mockTx as any);
      });

      // Act
      await service.create(mockUserId, createInput);

      // Assert
      expect(capturedBalanceChange).toBe(-createInput.amount); // Negative for expense
    });

    it('should not update balance for pending transactions', async () => {
      // Arrange
      const pendingInput = { ...createInput, isPending: true };
      prismaService.account.findFirst.mockResolvedValue(mockAccount as any);
      prismaService.category.findFirst.mockResolvedValue(mockCategory as any);

      const pendingTransaction = { ...mockTransaction, isPending: true };
      let accountUpdateCalled = false;

      prismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          transaction: {
            create: jest.fn().mockResolvedValue(pendingTransaction),
          },
          account: {
            update: jest.fn().mockImplementation(() => {
              accountUpdateCalled = true;
            }),
          },
        };
        return callback(mockTx as any);
      });

      // Act
      await service.create(mockUserId, pendingInput);

      // Assert
      expect(accountUpdateCalled).toBe(false);
    });
  });

  describe('findMany', () => {
    const mockTransactions = [
      mockTransaction,
      { ...mockTransaction, id: 'transaction-2' },
    ];

    it('should return paginated transactions', async () => {
      // Arrange
      const args = { first: 10 };
      prismaService.transaction.findMany.mockResolvedValue(
        mockTransactions as any,
      );
      prismaService.transaction.count.mockResolvedValue(2);

      jest.spyOn(PaginationUtil, 'createConnection').mockReturnValue({
        edges: mockTransactions.map((txn) => ({
          node: mapTransaction(txn as any),
          cursor: 'cursor',
        })),
        pageInfo: {
          hasNextPage: false,
          hasPreviousPage: false,
          startCursor: undefined,
          endCursor: undefined,
        },
        totalCount: 2,
      });

      // Act
      const result = await service.findMany(mockUserId, args);

      // Assert
      expect(prismaService.transaction.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        take: 11,
        orderBy: [{ txnDate: 'desc' }, { id: 'desc' }],
        include: {
          account: true,
          category: true,
          attachments: true,
          ...TRANSACTION_PRESENTATION_INCLUDE,
        },
      });
      expect(prismaService.transaction.count).toHaveBeenCalledWith({
        where: { userId: mockUserId },
      });
      expect(result.totalCount).toBe(2);
    });

    it('should apply filters when provided', async () => {
      // Arrange
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const args = {
        first: 10,
        filters: {
          accountId: mockAccountId,
          type: TransactionType.expense,
          categoryId: mockCategoryId,
          source: TransactionSource.manual,
          isPending: false,
          startDate,
          endDate,
          search: 'Test Store',
        },
      };

      prismaService.transaction.findMany.mockResolvedValue([
        mockTransaction,
      ] as any);
      prismaService.transaction.count.mockResolvedValue(1);
      prismaService.category.findMany.mockResolvedValue([]);

      jest.spyOn(PaginationUtil, 'createConnection').mockReturnValue({
        edges: [],
        pageInfo: {
          hasNextPage: false,
          hasPreviousPage: false,
          startCursor: undefined,
          endCursor: undefined,
        },
        totalCount: 1,
      });

      // Act
      await service.findMany(mockUserId, args);

      // Assert
      const expectedWhere = {
        userId: mockUserId,
        accountId: mockAccountId,
        categoryId: mockCategoryId,
        type: TransactionType.expense,
        source: TransactionSource.manual,
        isPending: false,
        txnDate: { gte: startDate, lte: endDate },
        OR: [
          { aliasName: { contains: 'Test Store', mode: 'insensitive' } },
          {
            aliasName: null,
            alias: {
              is: {
                displayName: { contains: 'Test Store', mode: 'insensitive' },
              },
            },
          },
          {
            isPrivate: false,
            OR: [{ aliasId: null }, { alias: { is: { isPrivate: false } } }],
            AND: [
              {
                OR: [
                  {
                    description: {
                      contains: 'Test Store',
                      mode: 'insensitive',
                    },
                  },
                  {
                    merchantName: {
                      contains: 'Test Store',
                      mode: 'insensitive',
                    },
                  },
                ],
              },
            ],
          },
        ],
      };
      expect(prismaService.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
      expect(prismaService.transaction.count).toHaveBeenCalledWith({
        where: expectedWhere,
      });
    });

    it('a parent category filter includes its subcategories at every level', async () => {
      // Arrange: parent -> [child-a, child-b] -> child-a has [grandchild]
      prismaService.transaction.findMany.mockResolvedValue([]);
      prismaService.transaction.count.mockResolvedValue(0);
      prismaService.category.findMany
        .mockResolvedValueOnce([{ id: 'child-a' }, { id: 'child-b' }] as any)
        .mockResolvedValueOnce([{ id: 'grandchild' }] as any)
        .mockResolvedValueOnce([]);

      // Act
      await service.findMany(mockUserId, {
        first: 10,
        filters: { categoryId: 'parent' },
      });

      // Assert
      expect(prismaService.category.findMany).toHaveBeenNthCalledWith(1, {
        where: {
          parentId: { in: ['parent'] },
          OR: [{ userId: mockUserId }, { userId: null }],
        },
        select: { id: true },
      });
      expect(prismaService.category.findMany).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: expect.objectContaining({
            parentId: { in: ['child-a', 'child-b'] },
          }),
        }),
      );
      const where = {
        userId: mockUserId,
        categoryId: { in: ['parent', 'child-a', 'child-b', 'grandchild'] },
      };
      expect(prismaService.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where }),
      );
      expect(prismaService.transaction.count).toHaveBeenCalledWith({ where });
    });

    it('a category without subcategories filters by its id only', async () => {
      prismaService.transaction.findMany.mockResolvedValue([]);
      prismaService.transaction.count.mockResolvedValue(0);
      prismaService.category.findMany.mockResolvedValue([]);

      await service.findMany(mockUserId, { filters: { categoryId: 'leaf' } });

      expect(prismaService.category.findMany).toHaveBeenCalledTimes(1);
      expect(prismaService.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: mockUserId, categoryId: 'leaf' },
        }),
      );
    });

    it('should handle cursor pagination', async () => {
      // Arrange
      const args = { after: 'cursor-123', first: 5 };
      prismaService.transaction.findMany.mockResolvedValue([
        mockTransaction,
      ] as any);
      prismaService.transaction.count.mockResolvedValue(1);

      jest.spyOn(PaginationUtil, 'decodeCursor').mockReturnValue('cursor-123');
      jest.spyOn(PaginationUtil, 'createConnection').mockReturnValue({
        edges: [],
        pageInfo: {
          hasNextPage: false,
          hasPreviousPage: false,
          startCursor: undefined,
          endCursor: undefined,
        },
        totalCount: 1,
      });

      // Act
      await service.findMany(mockUserId, args);

      // Assert
      expect(prismaService.transaction.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        take: 6,
        orderBy: [{ txnDate: 'desc' }, { id: 'desc' }],
        cursor: { id: 'cursor-123' },
        skip: 1,
        include: {
          account: true,
          category: true,
          attachments: true,
          ...TRANSACTION_PRESENTATION_INCLUDE,
        },
      });
    });

    it('reports a next page only when a row beyond the page exists', async () => {
      // The real cursor helpers, not the spies of the tests above.
      jest.restoreAllMocks();
      const rows = [1, 2, 3].map((n) => ({
        ...mockTransaction,
        id: `transaction-${n}`,
        account: null,
        category: null,
        attachments: [],
      }));
      prismaService.transaction.findMany.mockResolvedValue(rows as never);
      prismaService.transaction.count.mockResolvedValue(3);

      const firstPage = await service.findMany(mockUserId, { first: 2 });
      expect(firstPage.edges.map((e) => e.node.id)).toEqual([
        'transaction-1',
        'transaction-2',
      ]);
      expect(firstPage.pageInfo.hasNextPage).toBe(true);
      expect(firstPage.pageInfo.hasPreviousPage).toBe(false);

      prismaService.transaction.findMany.mockResolvedValue(
        rows.slice(2) as never,
      );
      const lastPage = await service.findMany(mockUserId, {
        first: 2,
        after: firstPage.pageInfo.endCursor,
      });
      expect(lastPage.edges.map((e) => e.node.id)).toEqual(['transaction-3']);
      expect(lastPage.pageInfo.hasNextPage).toBe(false);
      expect(lastPage.pageInfo.hasPreviousPage).toBe(true);
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
            transactionId: 'transaction-1',
            fileKey: 'users/u/attachments/a.pdf',
            fileName: 'ticket.pdf',
            fileUrl: null,
            fileType: 'application/pdf',
            fileSize: 1024,
            extra: null,
            uploadedAt: new Date('2024-01-01'),
          },
        ],
      };
      prismaService.transaction.findFirst.mockResolvedValue(
        transactionWithAttachments as any,
      );

      // Act
      const result = await service.findById(mockTransaction.id, mockUserId);

      // Assert
      expect(prismaService.transaction.findFirst).toHaveBeenCalledWith({
        where: { id: mockTransaction.id, userId: mockUserId },
        include: {
          attachments: true,
          account: true,
          category: true,
          ...TRANSACTION_PRESENTATION_INCLUDE,
        },
      });
      expect(result.id).toBe(mockTransaction.id);
    });

    it('should throw NotFoundError when transaction not found', async () => {
      // Arrange
      prismaService.transaction.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.findById('non-existent', mockUserId),
      ).rejects.toThrow(NotFoundError);
    });

    it('should return the attachments loaded with the transaction', async () => {
      // Arrange
      prismaService.transaction.findFirst.mockResolvedValue({
        ...mockTransaction,
        attachments: [
          {
            id: 'attachment-1',
            transactionId: mockTransaction.id,
            fileKey: 'users/u/attachments/attachment-1.pdf',
            fileName: 'ticket.pdf',
            fileUrl: null,
            fileType: 'application/pdf',
            fileSize: 1024,
            extra: null,
            uploadedAt: new Date('2024-01-01'),
          },
        ],
      } as any);

      // Act
      const result = await service.findById(mockTransaction.id, mockUserId);

      // Assert
      expect(result.attachments).toEqual([
        {
          id: 'attachment-1',
          transactionId: mockTransaction.id,
          fileName: 'ticket.pdf',
          fileType: 'application/pdf',
          fileSize: 1024,
          downloadPath: '/attachments/attachment-1/file',
          uploadedAt: new Date('2024-01-01'),
        },
      ]);
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
      const manualTransaction = {
        ...mockTransaction,
        source: TransactionSource.manual,
      };
      const updatedTransaction = { ...manualTransaction, ...updateInput };

      prismaService.transaction.findFirst.mockResolvedValue(
        manualTransaction as any,
      );
      prismaService.category.findFirst.mockResolvedValue({
        id: 'new-category-id',
      } as any);

      prismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          transaction: {
            update: jest.fn().mockResolvedValue(updatedTransaction),
          },
          account: { update: jest.fn() },
        };
        return callback(mockTx as any);
      });

      // Act
      const result = await service.update(
        mockTransaction.id,
        mockUserId,
        updateInput,
      );

      // Assert
      expect(result.description).toBe(updateInput.description);
      expect(result.merchantName).toBe(updateInput.merchantName);
    });

    it('should throw ValidationError for imported transactions', async () => {
      // Arrange
      const importedTransaction = {
        ...mockTransaction,
        source: TransactionSource.imported,
      };
      prismaService.transaction.findFirst.mockResolvedValue(
        importedTransaction as any,
      );

      // Act & Assert
      await expect(
        service.update(mockTransaction.id, mockUserId, updateInput),
      ).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when transaction not found', async () => {
      // Arrange
      prismaService.transaction.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.update('non-existent', mockUserId, updateInput),
      ).rejects.toThrow(NotFoundError);
    });

    it('should handle amount updates with balance recalculation', async () => {
      // Arrange
      const amountUpdateInput = { ...updateInput, amount: 150.0 };
      const manualTransaction = {
        ...mockTransaction,
        source: TransactionSource.manual,
      };
      const updatedTransaction = { ...manualTransaction, amount: 150.0 };

      prismaService.transaction.findFirst.mockResolvedValue(
        manualTransaction as any,
      );
      prismaService.category.findFirst.mockResolvedValue({
        id: 'new-category-id',
      } as any);

      let balanceAdjustment: number | undefined;
      prismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          transaction: {
            update: jest.fn().mockResolvedValue(updatedTransaction),
          },
          account: {
            update: jest.fn().mockImplementation((data) => {
              balanceAdjustment = data.data.balanceCurrent.increment;
            }),
          },
        };
        return callback(mockTx as any);
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
    const noLinks = {
      transferFrom: null,
      transferTo: null,
      debtPayment: null,
      goalContributions: [],
    };

    it.each([
      ['part of a transfer (from)', { transferFrom: { id: 'transfer-1' } }],
      ['part of a transfer (to)', { transferTo: { id: 'transfer-1' } }],
      ['a debt payment', { debtPayment: { id: 'payment-1' } }],
      ['linked to goal contributions', { goalContributions: [{ id: 'gc-1' }] }],
    ])(
      'should throw ValidationError when the transaction is %s',
      async (_label, links) => {
        // Arrange
        prismaService.transaction.findFirst.mockResolvedValue({
          ...mockTransaction,
          ...noLinks,
          ...links,
        } as any);

        // Act & Assert
        await expect(
          service.delete(mockTransaction.id, mockUserId),
        ).rejects.toThrow(ValidationError);
        expect(prismaService.$transaction).not.toHaveBeenCalled();
      },
    );

    it('should successfully delete manual transaction with balance adjustment', async () => {
      // Arrange
      const manualTransaction = {
        ...mockTransaction,
        ...noLinks,
        source: TransactionSource.manual,
      };
      prismaService.transaction.findFirst.mockResolvedValue(
        manualTransaction as any,
      );

      const mockTx = {
        transaction: { delete: jest.fn() },
        account: { update: jest.fn() },
      };
      prismaService.$transaction.mockImplementation(runTransactionWith(mockTx));

      // Act
      const result = await service.delete(mockTransaction.id, mockUserId);

      // Assert
      expect(prismaService.transaction.findFirst).toHaveBeenCalledWith({
        where: { id: mockTransaction.id, userId: mockUserId },
        include: {
          transferFrom: true,
          transferTo: true,
          debtPayment: true,
          goalContributions: true,
        },
      });
      expect(mockTx.account.update).toHaveBeenCalledWith({
        where: { id: mockAccountId },
        data: { balanceCurrent: { increment: 100 } },
      });
      expect(mockTx.transaction.delete).toHaveBeenCalledWith({
        where: { id: mockTransaction.id },
      });
      expect(result).toBe(true);
    });

    it('should throw ValidationError for imported transactions', async () => {
      // Arrange
      const importedTransaction = {
        ...mockTransaction,
        source: TransactionSource.imported,
      };
      prismaService.transaction.findFirst.mockResolvedValue(
        importedTransaction as any,
      );

      // Act & Assert
      await expect(
        service.delete(mockTransaction.id, mockUserId),
      ).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when transaction not found', async () => {
      // Arrange
      prismaService.transaction.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.delete('non-existent', mockUserId)).rejects.toThrow(
        NotFoundError,
      );
    });

    it('should reverse balance change when deleting transaction', async () => {
      // Arrange
      const expenseTransaction = {
        ...mockTransaction,
        ...noLinks,
        type: TransactionType.expense,
        amount: 100.0,
        source: TransactionSource.manual,
        isPending: false,
      };

      prismaService.transaction.findFirst.mockResolvedValue(
        expenseTransaction as any,
      );

      let balanceAdjustment: number | undefined;
      prismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          transaction: { delete: jest.fn() },
          account: {
            update: jest.fn().mockImplementation((data) => {
              balanceAdjustment = data.data.balanceCurrent.increment;
            }),
          },
        };
        return callback(mockTx as any);
      });

      // Act
      await service.delete(mockTransaction.id, mockUserId);

      // Assert
      // Deleting expense should add back the amount to balance (positive)
      expect(balanceAdjustment).toBe(100.0);
    });

    it('should not adjust balance for pending transactions', async () => {
      // Arrange
      const pendingTransaction = {
        ...mockTransaction,
        ...noLinks,
        source: TransactionSource.manual,
        isPending: true,
      };

      prismaService.transaction.findFirst.mockResolvedValue(
        pendingTransaction as any,
      );

      let accountUpdateCalled = false;
      prismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          transaction: { delete: jest.fn() },
          account: {
            update: jest.fn().mockImplementation(() => {
              accountUpdateCalled = true;
            }),
          },
        };
        return callback(mockTx as any);
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
      const result = mapTransaction({
        ...mockTransaction,
        attachments: undefined,
      } as any);

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
        externalId: undefined, // null is normalized to undefined
        createdAt: mockTransaction.createdAt,
        updatedAt: mockTransaction.updatedAt,
        displayName: mockTransaction.merchantName,
        isPrivate: false,
        originalDescription: mockTransaction.merchantName,
        aliasId: null,
        hasOwnAlias: false,
        categorySource: null,
        suggestedCategory: null,
      });
    });

    it('should map attachments with the relations', () => {
      // Arrange
      const transactionWithAttachments = {
        ...mockTransaction,
        account: null,
        category: null,
        attachments: [
          {
            id: 'attachment-1',
            transactionId: mockTransaction.id,
            fileKey: null,
            fileName: null,
            fileUrl: 'https://example.com/receipt.jpg',
            fileType: 'image/jpeg',
            fileSize: 2048,
            extra: 'ocr-text',
            uploadedAt: new Date('2024-01-01'),
          },
        ],
      };

      // Act
      const result = mapTransaction(transactionWithAttachments as any);

      // Assert: legacy external links are not downloadable through the API.
      expect(result.attachments!).toHaveLength(1);
      expect(result.attachments![0]).toEqual({
        id: 'attachment-1',
        transactionId: mockTransaction.id,
        fileName: undefined,
        fileType: 'image/jpeg',
        fileSize: 2048,
        downloadPath: undefined,
        uploadedAt: new Date('2024-01-01'),
      });
      expect(result.account).toBeUndefined();
      expect(result.category).toBeUndefined();
    });
  });

  describe('suggestCategoryForMerchant', () => {
    it('should return the most frequent category among similar merchants', async () => {
      // Arrange
      prismaService.transaction.findMany.mockResolvedValue([
        { categoryId: 'food-category' },
        { categoryId: 'coffee-category' },
        { categoryId: 'coffee-category' },
      ] as any);

      // Act
      const result = await service['suggestCategoryForMerchant'](
        mockUserId,
        'Starbucks Reserve',
      );

      // Assert
      expect(prismaService.transaction.findMany).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          merchantName: { contains: 'Starbucks', mode: 'insensitive' },
          categoryId: { not: null },
        },
        include: { category: true },
        orderBy: { txnDate: 'desc' },
        take: 5,
      });
      expect(result).toEqual({ id: 'coffee-category' });
    });

    it('should return null when no similar merchant found', async () => {
      // Arrange
      prismaService.transaction.findMany.mockResolvedValue([]);

      // Act
      const result = await service['suggestCategoryForMerchant'](
        mockUserId,
        'Unknown Merchant',
      );

      // Assert
      expect(result).toBeNull();
    });

    it('should return null without querying when merchant name is empty', async () => {
      // Act
      const result = await service['suggestCategoryForMerchant'](
        mockUserId,
        '',
      );

      // Assert
      expect(result).toBeNull();
      expect(prismaService.transaction.findMany).not.toHaveBeenCalled();
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle very large transaction amounts', async () => {
      // Arrange
      const largeAmountInput = {
        ...mockTransaction,
        amount: 999999999.99,
      };

      prismaService.account.findFirst.mockResolvedValue(mockAccount as any);
      prismaService.category.findFirst.mockResolvedValue(mockCategory as any);

      prismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          transaction: {
            create: jest.fn().mockResolvedValue(largeAmountInput),
          },
          account: { update: jest.fn() },
        };
        return callback(mockTx as any);
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
      prismaService.account.findFirst.mockResolvedValue(mockAccount as any);
      prismaService.$transaction.mockRejectedValue(
        new Error('Transaction conflict'),
      );

      // Act & Assert
      await expect(
        service.create(mockUserId, {
          accountId: mockAccountId,
          type: TransactionType.expense,
          amount: 100.0,
          currency: 'USD',
          txnDate: new Date(),
        }),
      ).rejects.toThrow('Transaction conflict');
    });

    it('should validate category belongs to user or is default', async () => {
      // Arrange
      const globalDefaultCategory = {
        id: 'global-category',
        userId: null,
        isDefault: true,
        name: 'Global Category',
      };

      prismaService.account.findFirst.mockResolvedValue(mockAccount as any);
      prismaService.category.findFirst.mockResolvedValue(
        globalDefaultCategory as any,
      );

      prismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          transaction: { create: jest.fn().mockResolvedValue(mockTransaction) },
          account: { update: jest.fn() },
        };
        return callback(mockTx as any);
      });

      // Act
      await service.create(mockUserId, {
        accountId: mockAccountId,
        categoryId: globalDefaultCategory.id,
        type: TransactionType.expense,
        amount: 100.0,
        currency: 'USD',
        txnDate: new Date(),
      });

      // Assert
      expect(prismaService.category.findFirst).toHaveBeenCalledWith({
        where: {
          id: globalDefaultCategory.id,
          OR: [{ userId: mockUserId }, { userId: null, isDefault: true }],
        },
      });
    });
  });

  describe('local dates', () => {
    const mockTxWith = () => ({
      transaction: {
        create: jest.fn().mockResolvedValue(mockTransaction),
        update: jest.fn().mockResolvedValue(mockTransaction),
      },
      account: { update: jest.fn() },
    });
    const input = {
      accountId: mockAccountId,
      type: TransactionType.expense,
      amount: 10,
      currency: 'MXN',
    };

    beforeEach(() => {
      prismaService.account.findFirst.mockResolvedValue(mockAccount as any);
    });

    it.each([
      ['a date-only value (parsed as UTC midnight)', '2026-10-13T00:00:00Z'],
      ['a late-evening Mexico City timestamp', '2026-10-14T04:30:00Z'],
      ['a midday timestamp', '2026-10-13T18:00:00Z'],
    ])('createTransaction stores %s as that local day', async (_, iso) => {
      const mockTx = mockTxWith();
      prismaService.$transaction.mockImplementation(runTransactionWith(mockTx));

      await service.create(mockUserId, { ...input, txnDate: new Date(iso) });

      expect(dataOf(mockTx.transaction.create).txnDate).toEqual(
        new Date('2026-10-13T00:00:00Z'),
      );
    });

    it('updateTransaction stores the local day', async () => {
      prismaService.transaction.findFirst.mockResolvedValue(
        mockTransaction as any,
      );
      const mockTx = mockTxWith();
      prismaService.$transaction.mockImplementation(runTransactionWith(mockTx));

      await service.update(mockTransaction.id, mockUserId, {
        txnDate: new Date('2026-10-14T04:30:00Z'),
      });

      expect(mockTx.transaction.update).toHaveBeenCalledWith({
        where: { id: mockTransaction.id },
        data: { txnDate: new Date('2026-10-13T00:00:00Z') },
      });
      expect(mockTx.account.update).not.toHaveBeenCalled();
    });

    it('bulkCreate stores the local day', async () => {
      prismaService.account.findMany.mockResolvedValue([mockAccount] as any);
      prismaService.transaction.findMany.mockResolvedValue([]);
      const mockTx = mockTxWith();
      prismaService.$transaction.mockImplementation(runTransactionWith(mockTx));

      await service.bulkCreate(mockUserId, [
        { ...input, txnDate: new Date('2026-10-14T04:30:00Z') },
      ]);

      expect(dataOf(mockTx.transaction.create).txnDate).toEqual(
        new Date('2026-10-13T00:00:00Z'),
      );
    });
  });

  describe('update balance effects', () => {
    const run = async (existing: any, input: any) => {
      prismaService.transaction.findFirst.mockResolvedValue({
        ...mockTransaction,
        ...existing,
      });
      const mockTx = {
        transaction: { update: jest.fn().mockResolvedValue(mockTransaction) },
        account: { update: jest.fn() },
      };
      prismaService.$transaction.mockImplementation(runTransactionWith(mockTx));
      await service.update(mockTransaction.id, mockUserId, input);
      return mockTx.account.update.mock.calls.map(
        (_, call) =>
          (
            dataOf(mockTx.account.update, call).balanceCurrent as {
              increment: number;
            }
          ).increment,
      );
    };

    it('does not touch the balance when a pending amount changes', async () => {
      expect(await run({ isPending: true }, { amount: 50 })).toEqual([]);
    });

    it('applies the amount when a pending expense is confirmed', async () => {
      expect(await run({ isPending: true }, { isPending: false })).toEqual([
        -100,
      ]);
    });

    it('reverts the amount when a confirmed expense becomes pending', async () => {
      expect(await run({ isPending: false }, { isPending: true })).toEqual([
        100,
      ]);
    });

    it('applies the difference for a confirmed income', async () => {
      expect(
        await run({ type: TransactionType.income }, { amount: 130 }),
      ).toEqual([30]);
    });
  });

  describe('findSimilar', () => {
    it('looks for the same amount within a cent and 3 days around the local day', async () => {
      prismaService.transaction.findMany.mockResolvedValue([
        mockTransaction,
      ] as any);

      const result = await service.findSimilar(mockUserId, {
        accountId: mockAccountId,
        amount: 100,
        date: new Date('2026-10-14T04:30:00Z'), // Oct 13 in Mexico City
        type: TransactionType.expense,
      });

      expect(prismaService.transaction.findMany).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          accountId: mockAccountId,
          type: TransactionType.expense,
          amount: { gte: 99.99, lte: 100.01 },
          txnDate: {
            gte: new Date('2026-10-10T00:00:00Z'),
            lte: new Date('2026-10-16T00:00:00Z'),
          },
        },
        orderBy: [{ txnDate: 'desc' }, { createdAt: 'desc' }],
        take: 5,
        include: TRANSACTION_PRESENTATION_INCLUDE,
      });
      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe(100);
    });

    it('matches any type when none is given', async () => {
      prismaService.transaction.findMany.mockResolvedValue([]);

      await service.findSimilar(mockUserId, {
        accountId: mockAccountId,
        amount: 0.1,
        date: new Date('2026-10-13T00:00:00Z'),
      });

      const { where } = prismaService.transaction.findMany.mock.calls[0][0]!;
      expect(where).not.toHaveProperty('type');
      expect(where!.amount).toEqual({ gte: 0.09, lte: 0.11 });
    });
  });

  describe('merchant aliases and rules', () => {
    const createInput = {
      accountId: mockAccountId,
      type: TransactionType.expense,
      amount: 80,
      currency: 'MXN',
      txnDate: new Date('2026-10-10'),
      merchantName: 'OXXO GAS 0042',
    };

    const runCreate = () => {
      prismaService.account.findFirst.mockResolvedValue(mockAccount as any);
      prismaService.category.findFirst.mockResolvedValue(mockCategory as any);
      const create = jest.fn(({ data }: { data: Record<string, unknown> }) => ({
        ...mockTransaction,
        ...data,
      }));
      prismaService.$transaction.mockImplementation(
        runTransactionWith({
          transaction: { create },
          account: { update: jest.fn() },
        }),
      );
      prismaService.transaction.findUnique.mockResolvedValue(null);
      prismaService.transaction.findMany.mockResolvedValue([]);
      return create;
    };

    it('create: a merchant rule categorizes before the frequency guess', async () => {
      rules.categoryFor.mockResolvedValue('fuel');
      const create = runCreate();

      await service.create(mockUserId, createInput);

      expect(rules.categoryFor).toHaveBeenCalledWith(
        mockUserId,
        'OXXO GAS 0042',
      );
      expect(create.mock.calls[0][0].data).toMatchObject({
        categoryId: 'fuel',
        categorySource: 'rule',
      });
      // No frequency lookup when a rule matched.
      expect(prismaService.transaction.findMany).not.toHaveBeenCalled();
    });

    it('create: a category from the user is manual', async () => {
      const create = runCreate();
      await service.create(mockUserId, {
        ...createInput,
        categoryId: mockCategoryId,
      });
      expect(create.mock.calls[0][0].data).toMatchObject({
        categoryId: mockCategoryId,
        categorySource: 'manual',
      });
      expect(rules.categoryFor).not.toHaveBeenCalled();
    });

    it("create: applies the user's aliases to the new movement and returns it with them", async () => {
      runCreate();
      prismaService.transaction.findUnique.mockResolvedValue({
        ...mockTransaction,
        aliasId: 'alias-1',
        alias: { displayName: 'Gasolina', isPrivate: true },
      } as any);

      const result = await service.create(mockUserId, createInput);

      expect(aliases.applyTo).toHaveBeenCalledWith(mockUserId, [
        mockTransaction.id,
      ]);
      expect(result).toMatchObject({
        displayName: 'Gasolina',
        isPrivate: true,
        aliasId: 'alias-1',
        originalDescription: null,
        merchantName: undefined,
        description: undefined,
      });
    });

    it('lists hide the original of private movements; the detail reveals it', async () => {
      const privateRow = {
        ...mockTransaction,
        isPrivate: true,
        aliasName: 'Sorpresa',
        account: null,
        category: null,
        attachments: [],
      };
      jest.restoreAllMocks();
      prismaService.transaction.findMany.mockResolvedValue([privateRow] as any);
      prismaService.transaction.count.mockResolvedValue(1);
      prismaService.transaction.findFirst.mockResolvedValue(privateRow as any);

      const list = await service.findMany(mockUserId, { first: 10 });
      expect(list.edges[0].node).toMatchObject({
        displayName: 'Sorpresa',
        isPrivate: true,
        hasOwnAlias: true,
        originalDescription: null,
        merchantName: undefined,
        description: undefined,
      });

      const detail = await service.findById(mockTransaction.id, mockUserId);
      expect(detail).toMatchObject({
        displayName: 'Sorpresa',
        isPrivate: true,
        originalDescription: 'Test Merchant',
        merchantName: 'Test Merchant',
      });
    });

    it('filters uncategorized movements and pending suggestions', async () => {
      jest.restoreAllMocks();
      prismaService.transaction.findMany.mockResolvedValue([]);
      prismaService.transaction.count.mockResolvedValue(0);

      await service.findMany(mockUserId, {
        filters: { uncategorized: true, hasSuggestion: true },
      });

      expect(prismaService.transaction.count).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          categoryId: null,
          suggestedCategoryId: { not: null },
        },
      });
    });

    describe('setTransactionAlias', () => {
      beforeEach(() => {
        prismaService.transaction.findFirst.mockResolvedValue({
          id: 't1',
        } as any);
        prismaService.transaction.update.mockImplementation(
          (args) => ({ ...mockTransaction, ...args.data }) as never,
        );
      });

      it('sets a one-off name and privacy, never the original text', async () => {
        const result = await service.setAlias('t1', mockUserId, {
          displayName: '  Regalo mamá ',
          isPrivate: true,
        });
        expect(prismaService.transaction.update).toHaveBeenCalledWith({
          where: { id: 't1' },
          data: { aliasName: 'Regalo mamá', isPrivate: true },
          include: TRANSACTION_PRESENTATION_INCLUDE,
        });
        expect(result).toMatchObject({
          displayName: 'Regalo mamá',
          hasOwnAlias: true,
          isPrivate: true,
          originalDescription: null,
        });
      });

      it('null or "" clears the name; omitted fields stay', async () => {
        await service.setAlias('t1', mockUserId, { displayName: '' });
        expect(prismaService.transaction.update).toHaveBeenLastCalledWith(
          expect.objectContaining({ data: { aliasName: null } }),
        );
        await service.setAlias('t1', mockUserId, { displayName: null });
        expect(prismaService.transaction.update).toHaveBeenLastCalledWith(
          expect.objectContaining({ data: { aliasName: null } }),
        );
        await service.setAlias('t1', mockUserId, { isPrivate: false });
        expect(prismaService.transaction.update).toHaveBeenLastCalledWith(
          expect.objectContaining({ data: { isPrivate: false } }),
        );
      });

      it("rejects another user's movement and names over 80 characters", async () => {
        await expect(
          service.setAlias('t1', mockUserId, { displayName: 'x'.repeat(81) }),
        ).rejects.toThrow(ValidationError);
        prismaService.transaction.findFirst.mockResolvedValue(null);
        await expect(
          service.setAlias('t9', mockUserId, { displayName: 'x' }),
        ).rejects.toThrow(NotFoundError);
        expect(prismaService.transaction.findFirst).toHaveBeenLastCalledWith({
          where: { id: 't9', userId: mockUserId },
          select: { id: true },
        });
      });
    });
  });

  describe('update rules for imported movements and transfers', () => {
    const arrange = (existing: Record<string, unknown>) => {
      prismaService.transaction.findFirst.mockResolvedValue({
        ...mockTransaction,
        transferFrom: null,
        transferTo: null,
        ...existing,
      } as any);
      prismaService.category.findFirst.mockResolvedValue({
        id: 'cat-2',
      } as any);
      const mockTx = {
        transaction: { update: jest.fn().mockResolvedValue(mockTransaction) },
        account: { update: jest.fn() },
      };
      prismaService.$transaction.mockImplementation(runTransactionWith(mockTx));
      return mockTx;
    };

    it.each([TransactionSource.imported, TransactionSource.statement])(
      '%s movements can change their category, without touching the balance',
      async (source) => {
        const mockTx = arrange({ source });
        await service.update(mockTransaction.id, mockUserId, {
          categoryId: 'cat-2',
        });
        expect(dataOf(mockTx.transaction.update)).toMatchObject({
          categoryId: 'cat-2',
          categorySource: 'manual',
        });
        expect(mockTx.account.update).not.toHaveBeenCalled();
      },
    );

    it.each([
      { amount: 5 },
      { description: 'x' },
      { merchantName: 'x' },
      { txnDate: new Date('2024-01-02') },
      { isPending: true },
    ])('imported movements reject %o', async (input) => {
      arrange({ source: TransactionSource.imported });
      await expect(
        service.update(mockTransaction.id, mockUserId, {
          categoryId: 'cat-2',
          ...input,
        }),
      ).rejects.toThrow('only the category can change');
    });

    it('rejects a new amount on either side of a transfer', async () => {
      arrange({
        type: TransactionType.transfer,
        transferFrom: { id: 'tr-1' },
      });
      await expect(
        service.update(mockTransaction.id, mockUserId, { amount: 120 }),
      ).rejects.toThrow(ValidationError);

      arrange({
        type: TransactionType.transfer,
        transferTo: { id: 'tr-1' },
      });
      await expect(
        service.update(mockTransaction.id, mockUserId, { amount: 120 }),
      ).rejects.toThrow(ValidationError);
    });

    it('a transfer side can still change its description (same amount allowed)', async () => {
      const mockTx = arrange({
        type: TransactionType.transfer,
        transferFrom: { id: 'tr-1' },
      });
      await service.update(mockTransaction.id, mockUserId, {
        description: 'Rent',
        amount: 100,
      });
      expect(dataOf(mockTx.transaction.update)).toMatchObject({
        description: 'Rent',
      });
    });
  });

  describe('detail links', () => {
    const side = (
      id: string,
      accountId: string,
      name: string,
      nickname?: string,
    ) => ({
      id,
      accountId,
      account: { name, metadata: nickname ? { nickname } : null },
    });

    it('returns the other side of a transfer with its account nickname', async () => {
      prismaService.transfer.findFirst.mockResolvedValue({
        fromTxnId: 't-out',
        fromTxn: side('t-out', 'acc-1', 'Debit'),
        toTxn: side('t-in', 'acc-2', 'Card', 'Mi tarjeta'),
      } as any);

      await expect(
        service.findTransferCounterpart('t-out', mockUserId),
      ).resolves.toEqual({
        transactionId: 't-in',
        accountId: 'acc-2',
        accountName: 'Mi tarjeta',
        direction: 'out',
      });
      expect(prismaService.transfer.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [{ fromTxnId: 't-out' }, { toTxnId: 't-out' }],
            fromTxn: { userId: mockUserId },
          },
        }),
      );

      await expect(
        service.findTransferCounterpart('t-in', mockUserId),
      ).resolves.toMatchObject({
        transactionId: 't-out',
        accountName: 'Debit',
        direction: 'in',
      });
    });

    it('returns null when the movement is not a transfer', async () => {
      prismaService.transfer.findFirst.mockResolvedValue(null);
      await expect(
        service.findTransferCounterpart('t-1', mockUserId),
      ).resolves.toBeNull();
    });

    it("returns the recurring payment the movement paid (only the user's)", async () => {
      const dueDate = new Date('2026-10-01T00:00:00Z');
      prismaService.recurringOccurrence.findFirst.mockResolvedValue({
        id: 'occ-1',
        dueDate,
        recurringExpense: { id: 'rec-1', name: 'Netflix' },
      } as any);

      await expect(
        service.findRecurringPayment('t-1', mockUserId),
      ).resolves.toEqual({
        occurrenceId: 'occ-1',
        recurringExpenseId: 'rec-1',
        name: 'Netflix',
        dueDate,
      });
      expect(prismaService.recurringOccurrence.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            transactionId: 't-1',
            recurringExpense: { userId: mockUserId },
          },
        }),
      );

      prismaService.recurringOccurrence.findFirst.mockResolvedValue(null);
      await expect(
        service.findRecurringPayment('t-2', mockUserId),
      ).resolves.toBeNull();
    });
  });
});
