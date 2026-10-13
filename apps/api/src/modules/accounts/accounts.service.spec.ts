import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { AccountsService } from './accounts.service';
import { PrismaService } from '../../services/prisma.service';
import {
  InvalidAccountTypeError,
  NotFoundError,
  ValidationError,
} from '../../common/exceptions/graphql-error.exception';
import {
  AccountType,
  TransactionType,
  TransactionSource,
} from '@finnit/database';
import { PaginationUtil } from '../../common/utils/pagination.util';

/** Makes `$transaction(callback)` run the callback against `tx`. */
const runTransactionWith = (tx: unknown) =>
  ((callback: (client: unknown) => unknown) =>
    Promise.resolve(callback(tx))) as never;

/** The `data` argument of the n-th call to a mocked create/update. */
const dataOf = (fn: jest.Mock, call = 0) =>
  (fn.mock.calls[call] as [{ data: Record<string, unknown> }])[0].data;

describe('AccountsService', () => {
  let service: AccountsService;
  let prismaService: DeepMockProxy<PrismaService>;

  const mockUserId = 'user-1';
  const mockAccount = {
    id: 'account-1',
    userId: mockUserId,
    type: AccountType.cash,
    name: 'Test Account',
    currency: 'USD',
    balanceCurrent: 1000.0,
    metadata: { test: 'data' },
    archived: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(async () => {
    prismaService = mockDeep<PrismaService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    service = module.get<AccountsService>(AccountsService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    const createInput = {
      type: AccountType.cash,
      name: 'New Account',
      currency: 'USD',
      initialBalance: 500.0,
      metadata: { bank: 'BBVA' },
    };

    const mockTxWith = () => ({
      account: { create: jest.fn() },
      transaction: { create: jest.fn() },
    });

    it('creates the account and its opening balance as an adjustment in one transaction', async () => {
      // Arrange
      const expectedAccount = { ...mockAccount, ...createInput };
      const mockTx = mockTxWith();
      mockTx.account.create.mockResolvedValue(expectedAccount);
      prismaService.$transaction.mockImplementation(runTransactionWith(mockTx));

      // Act
      const result = await service.create(mockUserId, createInput);

      // Assert
      expect(prismaService.$transaction).toHaveBeenCalledTimes(1);
      expect(prismaService.account.create).not.toHaveBeenCalled();
      expect(mockTx.account.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          type: createInput.type,
          name: createInput.name,
          currency: createInput.currency,
          balanceCurrent: createInput.initialBalance,
          metadata: createInput.metadata,
        },
      });

      expect(mockTx.transaction.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          accountId: expectedAccount.id,
          type: TransactionType.adjustment,
          amount: Math.abs(createInput.initialBalance),
          currency: createInput.currency,
          txnDate: expect.any(Date),
          description: 'Initial balance',
          source: TransactionSource.manual,
        },
      });
      const txnDate = dataOf(mockTx.transaction.create).txnDate as Date;
      expect(txnDate.getTime() % 86_400_000).toBe(0);

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
      const mockTx = mockTxWith();
      mockTx.account.create.mockResolvedValue({
        ...mockAccount,
        ...zeroBalanceInput,
        balanceCurrent: 0,
      });
      prismaService.$transaction.mockImplementation(runTransactionWith(mockTx));

      // Act
      await service.create(mockUserId, zeroBalanceInput);

      // Assert
      expect(mockTx.account.create).toHaveBeenCalled();
      expect(mockTx.transaction.create).not.toHaveBeenCalled();
    });

    it('records a negative opening balance as an adjustment of its absolute value', async () => {
      // Arrange
      const negativeBalanceInput = { ...createInput, initialBalance: -200.0 };
      const mockTx = mockTxWith();
      mockTx.account.create.mockResolvedValue({
        ...mockAccount,
        ...negativeBalanceInput,
      });
      prismaService.$transaction.mockImplementation(runTransactionWith(mockTx));

      // Act
      await service.create(mockUserId, negativeBalanceInput);

      // Assert
      expect(mockTx.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: TransactionType.adjustment,
          amount: 200.0,
        }),
      });
    });

    it('omits metadata when none is given', async () => {
      const mockTx = mockTxWith();
      mockTx.account.create.mockResolvedValue(mockAccount);
      prismaService.$transaction.mockImplementation(runTransactionWith(mockTx));

      await service.create(mockUserId, {
        ...createInput,
        metadata: undefined,
      });

      expect(dataOf(mockTx.account.create)).not.toHaveProperty('metadata');
    });

    it('rejects an invalid design color before writing', async () => {
      await expect(
        service.create(mockUserId, {
          ...createInput,
          metadata: { design: { primaryColor: 'red' } },
        } as any),
      ).rejects.toThrow(ValidationError);
      expect(prismaService.$transaction).not.toHaveBeenCalled();
    });

    it('should handle account creation errors', async () => {
      // Arrange
      prismaService.$transaction.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(
        service.create(mockUserId, createInput as any),
      ).rejects.toThrow('Database error');
    });
  });

  describe('findMany', () => {
    const mockAccounts = [mockAccount, { ...mockAccount, id: 'account-2' }];
    const orderBy = [{ createdAt: 'desc' }, { id: 'desc' }];
    const cursorOf = (id: string) => PaginationUtil.encodeCursor(id);

    it('pages newest first with a look-ahead row and default size', async () => {
      // Arrange
      prismaService.account.findMany.mockResolvedValue(mockAccounts as any);
      prismaService.account.count.mockResolvedValue(2);

      // Act
      const result = await service.findMany(mockUserId, {});

      // Assert
      expect(prismaService.account.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        orderBy,
        take: 21,
        include: { creditCardTerms: true },
      });
      expect(result.totalCount).toBe(2);
      expect(result.edges.map((e) => e.node.id)).toEqual([
        'account-1',
        'account-2',
      ]);
      expect(result.edges[0].cursor).toBe(cursorOf('account-1'));
      expect(result.pageInfo.hasNextPage).toBe(false);
    });

    it('should filter accounts by type', async () => {
      prismaService.account.findMany.mockResolvedValue([mockAccount] as any);
      prismaService.account.count.mockResolvedValue(1);

      await service.findMany(mockUserId, { type: AccountType.savings });

      expect(prismaService.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: mockUserId, type: AccountType.savings },
        }),
      );
    });

    it('should filter accounts by archived status', async () => {
      prismaService.account.findMany.mockResolvedValue([]);
      prismaService.account.count.mockResolvedValue(0);

      await service.findMany(mockUserId, { archived: true });

      expect(prismaService.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: mockUserId, archived: true },
        }),
      );
    });

    it('continues after the cursor row in (createdAt, id) order, not by id > cursor', async () => {
      // Arrange: 3 rows come back for first: 2, so there is a next page.
      prismaService.account.findMany.mockResolvedValue([
        { ...mockAccount, id: 'b' } as any,
        { ...mockAccount, id: 'a' } as any,
        { ...mockAccount, id: 'z' } as any,
      ]);
      prismaService.account.count.mockResolvedValue(10);

      // Act
      const result = await service.findMany(mockUserId, {
        first: 2,
        after: cursorOf('account-1'),
      });

      // Assert
      expect(prismaService.account.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        orderBy,
        take: 3,
        cursor: { id: 'account-1' },
        skip: 1,
        include: { creditCardTerms: true },
      });
      expect(result.edges.map((e) => e.node.id)).toEqual(['b', 'a']);
      expect(result.pageInfo).toEqual(
        expect.objectContaining({
          hasNextPage: true,
          hasPreviousPage: true,
          endCursor: cursorOf('a'),
        }),
      );
    });

    it('pages backwards before the cursor', async () => {
      // Arrange: last: 2 asks for 3 rows ending at the cursor.
      prismaService.account.findMany.mockResolvedValue([
        { ...mockAccount, id: 'x' } as any,
        { ...mockAccount, id: 'y' } as any,
        { ...mockAccount, id: 'z' } as any,
      ]);
      prismaService.account.count.mockResolvedValue(10);

      // Act
      const result = await service.findMany(mockUserId, {
        last: 2,
        before: cursorOf('account-9'),
      });

      // Assert
      expect(prismaService.account.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        orderBy,
        take: -3,
        cursor: { id: 'account-9' },
        skip: 1,
        include: { creditCardTerms: true },
      });
      expect(result.edges.map((e) => e.node.id)).toEqual(['y', 'z']);
      expect(result.pageInfo.hasPreviousPage).toBe(true);
      expect(result.pageInfo.hasNextPage).toBe(true);
    });
  });

  describe('findById', () => {
    it('should return account when found', async () => {
      // Arrange
      prismaService.account.findFirst.mockResolvedValue(mockAccount as any);

      // Act
      const result = await service.findById(mockAccount.id, mockUserId);

      // Assert
      expect(prismaService.account.findFirst).toHaveBeenCalledWith({
        where: { id: mockAccount.id, userId: mockUserId },
        include: { creditCardTerms: true },
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
      await expect(
        service.findById('non-existent', mockUserId),
      ).rejects.toThrow(NotFoundError);
    });

    it('should not return account from different user', async () => {
      // Arrange
      prismaService.account.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.findById(mockAccount.id, 'different-user'),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('update', () => {
    const updateInput = {
      name: 'Updated Account',
      metadata: { nickname: 'Daily card' },
    };

    it('merges the metadata into the stored one so bank fields survive', async () => {
      // Arrange
      const stored = {
        ...mockAccount,
        metadata: { bank: 'BBVA', last4: '1234', provider: 'syncfy' },
      };
      prismaService.account.findFirst.mockResolvedValue(stored as any);
      prismaService.account.update.mockImplementation(((args: {
        data: object;
      }) => Promise.resolve({ ...stored, ...args.data })) as never);

      // Act
      const result = await service.update(mockAccount.id, mockUserId, {
        name: 'Updated Account',
        metadata: {
          nickname: '  Daily card  ',
          design: { primaryColor: '#112233', secondaryColor: '#AABBCC' },
        },
      });

      // Assert
      expect(prismaService.account.findFirst).toHaveBeenCalledWith({
        where: { id: mockAccount.id, userId: mockUserId },
      });
      expect(prismaService.account.update).toHaveBeenCalledWith({
        where: { id: mockAccount.id },
        data: {
          name: 'Updated Account',
          metadata: {
            bank: 'BBVA',
            last4: '1234',
            provider: 'syncfy',
            nickname: 'Daily card',
            design: { primaryColor: '#112233', secondaryColor: '#AABBCC' },
          },
        },
      });
      expect(result.metadata?.nickname).toBe('Daily card');
      expect(result.metadata?.bank).toBe('BBVA');
    });

    it('removes a metadata field sent as null', async () => {
      prismaService.account.findFirst.mockResolvedValue({
        ...mockAccount,
        metadata: { bank: 'BBVA', nickname: 'Old' },
      } as any);
      prismaService.account.update.mockResolvedValue(mockAccount as any);

      await service.update(mockAccount.id, mockUserId, {
        metadata: { nickname: null } as any,
      });

      expect(prismaService.account.update).toHaveBeenCalledWith({
        where: { id: mockAccount.id },
        data: { metadata: { bank: 'BBVA' } },
      });
    });

    it('leaves the metadata alone when none is given', async () => {
      prismaService.account.findFirst.mockResolvedValue(mockAccount as any);
      prismaService.account.update.mockResolvedValue(mockAccount as any);

      await service.update(mockAccount.id, mockUserId, { archived: true });

      expect(prismaService.account.update).toHaveBeenCalledWith({
        where: { id: mockAccount.id },
        data: { archived: true },
      });
    });

    it.each([
      [{ nickname: '' }],
      [{ nickname: 'x'.repeat(41) }],
      [{ design: { primaryColor: '#12345' } }],
      [{ design: { primaryColor: '#123456', secondaryColor: 'blue' } }],
    ])('rejects invalid personalization %j', async (metadata) => {
      prismaService.account.findFirst.mockResolvedValue(mockAccount as any);

      await expect(
        service.update(mockAccount.id, mockUserId, { metadata } as any),
      ).rejects.toThrow(ValidationError);
      expect(prismaService.account.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError when account not found', async () => {
      // Arrange
      prismaService.account.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.update('non-existent', mockUserId, updateInput),
      ).rejects.toThrow(NotFoundError);
      expect(prismaService.account.update).not.toHaveBeenCalled();
    });

    it('should handle update errors', async () => {
      // Arrange
      prismaService.account.findFirst.mockResolvedValue(mockAccount as any);
      prismaService.account.update.mockRejectedValue(
        new Error('Update failed'),
      );

      // Act & Assert
      await expect(
        service.update(mockAccount.id, mockUserId, updateInput),
      ).rejects.toThrow('Update failed');
    });
  });

  describe('credit card terms', () => {
    const creditAccount = { ...mockAccount, type: AccountType.credit };
    const terms = {
      statementDay: 5,
      paymentDueDay: 25,
      interestRateAnnual: 45.5,
      gracePeriodDays: 0,
    };

    it('upserts the terms of a credit account and returns the account with them', async () => {
      // Arrange
      prismaService.account.findFirst
        .mockResolvedValueOnce(creditAccount as any)
        .mockResolvedValueOnce({
          ...creditAccount,
          creditCardTerms: {
            accountId: creditAccount.id,
            ...terms,
            minPaymentRule: null,
            updatedAt: new Date('2026-10-13'),
          },
        } as any);

      // Act
      const result = await service.setCreditCardTerms(
        creditAccount.id,
        mockUserId,
        terms,
      );

      // Assert
      const data = {
        statementDay: 5,
        paymentDueDay: 25,
        interestRateAnnual: 45.5,
        minPaymentRule: null,
        gracePeriodDays: 0,
      };
      expect(prismaService.creditCardTerms.upsert).toHaveBeenCalledWith({
        where: { accountId: creditAccount.id },
        create: { accountId: creditAccount.id, ...data },
        update: data,
      });
      expect(result.creditCardTerms).toEqual(
        expect.objectContaining({
          statementDay: 5,
          paymentDueDay: 25,
          interestRateAnnual: 45.5,
          gracePeriodDays: 0,
        }),
      );
    });

    it('rejects accounts that are not credit cards', async () => {
      prismaService.account.findFirst.mockResolvedValue(mockAccount as any);

      await expect(
        service.setCreditCardTerms(mockAccount.id, mockUserId, terms),
      ).rejects.toThrow(InvalidAccountTypeError);
      expect(prismaService.creditCardTerms.upsert).not.toHaveBeenCalled();
    });

    it("rejects another user's account", async () => {
      prismaService.account.findFirst.mockResolvedValue(null);

      await expect(
        service.setCreditCardTerms('other', mockUserId, terms),
      ).rejects.toThrow(NotFoundError);
    });

    it.each([
      [{ statementDay: 0, paymentDueDay: 10 }],
      [{ statementDay: 5, paymentDueDay: 32 }],
      [{ statementDay: 5.5, paymentDueDay: 10 }],
      [{ statementDay: 5, paymentDueDay: 10, interestRateAnnual: 201 }],
      [{ statementDay: 5, paymentDueDay: 10, interestRateAnnual: -1 }],
      [{ statementDay: 5, paymentDueDay: 10, gracePeriodDays: -2 }],
    ])('rejects invalid terms %j', async (input) => {
      prismaService.account.findFirst.mockResolvedValue(creditAccount as any);

      await expect(
        service.setCreditCardTerms(creditAccount.id, mockUserId, input),
      ).rejects.toThrow(ValidationError);
      expect(prismaService.creditCardTerms.upsert).not.toHaveBeenCalled();
    });

    it('removes the terms of a credit account', async () => {
      prismaService.account.findFirst.mockResolvedValue(creditAccount as any);

      const result = await service.removeCreditCardTerms(
        creditAccount.id,
        mockUserId,
      );

      expect(prismaService.creditCardTerms.deleteMany).toHaveBeenCalledWith({
        where: { accountId: creditAccount.id },
      });
      expect(result.creditCardTerms).toBeUndefined();
    });

    it('does not remove terms from a non-credit account', async () => {
      prismaService.account.findFirst.mockResolvedValue(mockAccount as any);

      await expect(
        service.removeCreditCardTerms(mockAccount.id, mockUserId),
      ).rejects.toThrow(InvalidAccountTypeError);
      expect(prismaService.creditCardTerms.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('adjustBalance', () => {
    const adjustInput = {
      accountId: mockAccount.id,
      amount: 100.0,
      description: 'Balance adjustment',
    };

    it('should successfully adjust account balance with positive amount', async () => {
      // Arrange
      const updatedAccount = { ...mockAccount, balanceCurrent: 1100.0 };
      prismaService.account.findFirst.mockResolvedValue(mockAccount as any);

      prismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          transaction: { create: jest.fn() },
          account: {
            update: jest.fn().mockResolvedValue(updatedAccount),
          },
        };
        return callback(mockTx as any);
      });

      // Act
      const result = await service.adjustBalance(mockUserId, adjustInput);

      // Assert
      expect(prismaService.account.findFirst).toHaveBeenCalledWith({
        where: { id: adjustInput.accountId, userId: mockUserId },
      });
      expect(result.balanceCurrent).toBe(1100.0);
    });

    it('should successfully adjust account balance with negative amount', async () => {
      // Arrange
      const negativeAdjustInput = { ...adjustInput, amount: -50.0 };
      const updatedAccount = { ...mockAccount, balanceCurrent: 950.0 };
      prismaService.account.findFirst.mockResolvedValue(mockAccount as any);

      prismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          transaction: { create: jest.fn() },
          account: {
            update: jest.fn().mockResolvedValue(updatedAccount),
          },
        };
        return callback(mockTx as any);
      });

      // Act
      const result = await service.adjustBalance(
        mockUserId,
        negativeAdjustInput,
      );

      // Assert
      expect(result.balanceCurrent).toBe(950.0);
    });

    it('should throw ValidationError for zero adjustment amount', async () => {
      // Arrange
      const zeroAdjustInput = { ...adjustInput, amount: 0 };
      prismaService.account.findFirst.mockResolvedValue(mockAccount as any);

      // Act & Assert
      await expect(
        service.adjustBalance(mockUserId, zeroAdjustInput),
      ).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when account not found', async () => {
      // Arrange
      prismaService.account.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.adjustBalance(mockUserId, adjustInput),
      ).rejects.toThrow(NotFoundError);
    });

    it('should create adjustment transaction with correct data', async () => {
      // Arrange
      const updatedAccount = { ...mockAccount, balanceCurrent: 1100.0 };
      prismaService.account.findFirst.mockResolvedValue(mockAccount as any);

      let capturedTransactionData: any;
      prismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          transaction: {
            create: jest.fn().mockImplementation((data) => {
              capturedTransactionData = data;
            }),
          },
          account: {
            update: jest.fn().mockResolvedValue(updatedAccount),
          },
        };
        return callback(mockTx as any);
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
      prismaService.account.findFirst.mockResolvedValue(mockAccount as any);
      prismaService.$transaction.mockRejectedValue(
        new Error('Transaction failed'),
      );

      // Act & Assert
      await expect(
        service.adjustBalance(mockUserId, adjustInput),
      ).rejects.toThrow('Transaction failed');
    });
  });

  describe('delete', () => {
    it('should successfully delete account without transactions', async () => {
      // Arrange
      const accountWithoutTransactions = { ...mockAccount, transactions: [] };
      prismaService.account.findFirst.mockResolvedValue(
        accountWithoutTransactions as any,
      );
      prismaService.account.delete.mockResolvedValue(mockAccount as any);

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
        transactions: [{ id: 'txn-1' }] as any,
      };
      prismaService.account.findFirst.mockResolvedValue(
        accountWithTransactions as any,
      );

      // Act & Assert
      await expect(service.delete(mockAccount.id, mockUserId)).rejects.toThrow(
        ValidationError,
      );
      expect(prismaService.account.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError when account not found', async () => {
      // Arrange
      prismaService.account.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.delete('non-existent', mockUserId)).rejects.toThrow(
        NotFoundError,
      );
      expect(prismaService.account.delete).not.toHaveBeenCalled();
    });

    it('should handle delete errors', async () => {
      // Arrange
      const accountWithoutTransactions = { ...mockAccount, transactions: [] };
      prismaService.account.findFirst.mockResolvedValue(
        accountWithoutTransactions as any,
      );
      prismaService.account.delete.mockRejectedValue(
        new Error('Delete failed'),
      );

      // Act & Assert
      await expect(service.delete(mockAccount.id, mockUserId)).rejects.toThrow(
        'Delete failed',
      );
    });
  });

  describe('mapAccount', () => {
    it('should correctly map account with all fields', () => {
      // Act
      const result = service['mapAccount'](mockAccount as any);

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
      const result = service['mapAccount'](accountWithoutMetadata as any);

      // Assert
      expect(result.metadata).toBeUndefined();
    });

    it('should correctly convert Decimal balance to number', () => {
      // Arrange
      const accountWithDecimal = {
        ...mockAccount,
        balanceCurrent: { toString: () => '1234.56' } as any,
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
      prismaService.account.findFirst.mockResolvedValue(mockAccount as any);

      prismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          transaction: { create: jest.fn() },
          account: { update: jest.fn().mockResolvedValue(updatedAccount) },
        };
        return callback(mockTx as any);
      });

      // Act
      const result = await service.adjustBalance(mockUserId, largeAdjustInput);

      // Assert
      expect(result.balanceCurrent).toBe(1000999999.99);
    });

    it('should handle concurrent balance adjustments', async () => {
      // Arrange
      prismaService.account.findFirst.mockResolvedValue(mockAccount as any);
      prismaService.$transaction.mockRejectedValue(
        new Error('Concurrent modification'),
      );

      // Act & Assert
      await expect(
        service.adjustBalance(mockUserId, {
          accountId: mockAccount.id,
          amount: 100.0,
          description: 'Concurrent test',
        }),
      ).rejects.toThrow('Concurrent modification');
    });

    it('should handle invalid currency codes in creation', async () => {
      // This would be handled by validation at the GraphQL layer
      // but we can test the service behavior
      const invalidCurrencyInput = {
        type: AccountType.cash,
        name: 'Test Account',
        currency: 'INVALID',
        initialBalance: 100.0,
      };

      prismaService.$transaction.mockRejectedValue(
        new Error('Invalid currency'),
      );

      await expect(
        service.create(mockUserId, invalidCurrencyInput),
      ).rejects.toThrow('Invalid currency');
    });
  });
});
