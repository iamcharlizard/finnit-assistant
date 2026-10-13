import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { DebtsService } from './debts.service';
import { PrismaService } from '../../services/prisma.service';
import {
  NotFoundError,
  ValidationError,
  DebtOverpaymentError,
} from '../../common/exceptions/graphql-error.exception';
import { PaginationUtil } from '../../common/utils/pagination.util';
import { DebtKind } from '@finnit/database';

describe('DebtsService', () => {
  let service: DebtsService;
  let prismaService: DeepMockProxy<PrismaService>;

  const mockUserId = 'user-1';
  const mockDebtId = 'debt-1';
  const mockTransactionId = 'transaction-1';
  const mockAccountId = 'account-1';

  const mockPayment = {
    id: 'payment-1',
    debtId: mockDebtId,
    transactionId: mockTransactionId,
    amount: 200.0,
    date: new Date('2024-01-15'),
  };

  const mockDebt = {
    id: mockDebtId,
    userId: mockUserId,
    name: 'Credit Card Debt',
    kind: DebtKind.card,
    principal: 5000.0,
    interestRateAnnual: 18.5,
    minPaymentAmount: 150.0,
    startDate: new Date('2024-01-01'),
    dueDate: new Date('2026-01-01'),
    linkedAccountId: mockAccountId,
    createdAt: new Date('2024-01-01'),
    payments: [mockPayment],
  };

  beforeEach(async () => {
    prismaService = mockDeep<PrismaService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DebtsService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    service = module.get<DebtsService>(DebtsService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    const createInput = {
      name: 'Personal Loan',
      kind: DebtKind.loan,
      principal: 15000.0,
      interestRateAnnual: 7.5,
      minPaymentAmount: 300.0,
      startDate: new Date('2024-01-01'),
      dueDate: new Date('2029-01-01'),
      linkedAccountId: mockAccountId,
    };

    it('should successfully create a new debt', async () => {
      // Arrange
      const mockAccount = { id: mockAccountId, userId: mockUserId };
      prismaService.account.findFirst.mockResolvedValue(mockAccount as any);

      const expectedDebt = { ...mockDebt, ...createInput, payments: [] };
      prismaService.debt.create.mockResolvedValue(expectedDebt as any);

      // Act
      const result = await service.create(mockUserId, createInput);

      // Assert
      expect(prismaService.account.findFirst).toHaveBeenCalledWith({
        where: { id: mockAccountId, userId: mockUserId },
      });
      expect(prismaService.debt.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          name: createInput.name,
          kind: createInput.kind,
          principal: createInput.principal,
          interestRateAnnual: createInput.interestRateAnnual,
          minPaymentAmount: createInput.minPaymentAmount,
          startDate: createInput.startDate,
          dueDate: createInput.dueDate,
          linkedAccountId: createInput.linkedAccountId,
        },
      });
      expect(result.principal).toBe(Number(createInput.principal));
      expect(result.totalPaid).toBe(0);
      expect(result.remainingBalance).toBe(createInput.principal);
    });

    it('should create debt without linked account', async () => {
      // Arrange
      const inputWithoutAccount: any = { ...createInput };
      delete inputWithoutAccount.linkedAccountId;

      const debtWithoutAccount = { ...mockDebt, linkedAccountId: null };
      prismaService.debt.create.mockResolvedValue(debtWithoutAccount as any);

      // Act
      const result = await service.create(mockUserId, inputWithoutAccount);

      // Assert
      expect(prismaService.account.findFirst).not.toHaveBeenCalled();
      expect(prismaService.debt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          linkedAccountId: undefined,
        }),
      });
      expect(result.linkedAccountId).toBeUndefined();
    });

    it('should throw NotFoundError when linked account not found', async () => {
      // Arrange
      prismaService.account.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.create(mockUserId, createInput)).rejects.toThrow(
        NotFoundError,
      );
      expect(prismaService.debt.create).not.toHaveBeenCalled();
    });

    it('should validate positive principal amount', async () => {
      // Arrange
      const invalidInput = { ...createInput, principal: -1000.0 };
      prismaService.account.findFirst.mockResolvedValue({
        id: mockAccountId,
      } as any);

      // Act & Assert
      await expect(service.create(mockUserId, invalidInput)).rejects.toThrow(
        ValidationError,
      );
    });

    it('should validate non-negative interest rate', async () => {
      // Arrange
      const invalidInput = { ...createInput, interestRateAnnual: -5.0 };
      prismaService.account.findFirst.mockResolvedValue({
        id: mockAccountId,
      } as any);

      // Act & Assert
      await expect(service.create(mockUserId, invalidInput)).rejects.toThrow(
        ValidationError,
      );
    });

    it('should validate reasonable interest rates', async () => {
      // Arrange
      const extremeRateInput = {
        name: 'Loan Shark',
        kind: DebtKind.loan,
        principal: 1000.0,
        interestRateAnnual: 999.99,
      };

      // Act & Assert
      await expect(
        service.create(mockUserId, extremeRateInput),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('findMany', () => {
    it('should return a connection of debts with payment totals', async () => {
      // Arrange
      const mockDebts = [
        mockDebt,
        { ...mockDebt, id: 'debt-2', name: 'Student Loan', payments: [] },
      ];
      prismaService.debt.findMany.mockResolvedValue(mockDebts as any);
      prismaService.debt.count.mockResolvedValue(2);

      // Act
      const result = await service.findMany(mockUserId, { first: 10 });

      // Assert
      expect(prismaService.debt.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 11,
        include: { payments: { orderBy: { date: 'desc' } } },
      });
      expect(prismaService.debt.count).toHaveBeenCalledWith({
        where: { userId: mockUserId },
      });
      expect(result.totalCount).toBe(2);
      expect(result.edges).toHaveLength(2);
      expect(result.edges[0].cursor).toBe(
        PaginationUtil.encodeCursor(mockDebtId),
      );
      expect(result.edges[0].node).toEqual(
        expect.objectContaining({
          id: mockDebtId,
          totalPaid: 200,
          remainingBalance: 4800,
        }),
      );
      expect(result.edges[1].node).toEqual(
        expect.objectContaining({
          id: 'debt-2',
          totalPaid: 0,
          remainingBalance: 5000,
        }),
      );
    });

    it('should filter by kind and continue after the cursor row in (createdAt, id) order', async () => {
      // Arrange: first: 1 fetches one extra row to know there is more.
      prismaService.debt.findMany.mockResolvedValue([
        { ...mockDebt, id: 'debt-older', payments: [] },
        { ...mockDebt, id: 'debt-oldest', payments: [] },
      ] as any);
      prismaService.debt.count.mockResolvedValue(3);
      const after = PaginationUtil.encodeCursor('debt-0');

      // Act
      const result = await service.findMany(mockUserId, {
        first: 1,
        after,
        kind: DebtKind.loan,
      });

      // Assert
      expect(prismaService.debt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: mockUserId, kind: DebtKind.loan },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          cursor: { id: 'debt-0' },
          skip: 1,
          take: 2,
        }),
      );
      expect(prismaService.debt.count).toHaveBeenCalledWith({
        where: { userId: mockUserId, kind: DebtKind.loan },
      });
      expect(result.edges.map((e) => e.node.id)).toEqual(['debt-older']);
      expect(result.pageInfo.hasNextPage).toBe(true);
      expect(result.pageInfo.hasPreviousPage).toBe(true);
    });

    it('should default to 20 items and return an empty connection when no debts exist', async () => {
      // Arrange
      prismaService.debt.findMany.mockResolvedValue([]);
      prismaService.debt.count.mockResolvedValue(0);

      // Act
      const result = await service.findMany(mockUserId, {});

      // Assert
      expect(prismaService.debt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 21 }),
      );
      expect(result.edges).toEqual([]);
      expect(result.totalCount).toBe(0);
    });
  });

  describe('findById', () => {
    it('should return debt when found', async () => {
      // Arrange
      prismaService.debt.findFirst.mockResolvedValue(mockDebt as any);

      // Act
      const result = await service.findById(mockDebtId, mockUserId);

      // Assert
      expect(prismaService.debt.findFirst).toHaveBeenCalledWith({
        where: { id: mockDebtId, userId: mockUserId },
        include: { payments: { orderBy: { date: 'desc' } } },
      });
      expect(result.id).toBe(mockDebtId);
      expect(result.totalPaid).toBe(200);
      expect(result.remainingBalance).toBe(4800);
    });

    it('should throw NotFoundError when debt not found', async () => {
      // Arrange
      prismaService.debt.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.findById('non-existent', mockUserId),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('update', () => {
    const updateInput = {
      name: 'Updated Debt Name',
      minPaymentAmount: 200.0,
      dueDate: new Date('2027-01-01'),
    };

    it('should successfully update debt', async () => {
      // Arrange
      const existingDebt = { ...mockDebt };
      const updatedDebt = { ...existingDebt, ...updateInput };

      prismaService.debt.findFirst.mockResolvedValue(existingDebt as any);
      prismaService.debt.update.mockResolvedValue(updatedDebt as any);

      // Act
      const result = await service.update(mockDebtId, mockUserId, updateInput);

      // Assert
      expect(prismaService.debt.findFirst).toHaveBeenCalledWith({
        where: { id: mockDebtId, userId: mockUserId },
        include: { payments: true },
      });
      expect(prismaService.debt.update).toHaveBeenCalledWith({
        where: { id: mockDebtId },
        data: updateInput,
        include: { payments: true },
      });
      expect(result.name).toBe(updateInput.name);
      expect(result.minPaymentAmount).toBe(200);
      expect(result.totalPaid).toBe(200);
    });

    it('should throw NotFoundError when debt not found', async () => {
      // Arrange
      prismaService.debt.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.update('non-existent', mockUserId, updateInput),
      ).rejects.toThrow(NotFoundError);
      expect(prismaService.debt.update).not.toHaveBeenCalled();
    });

    it('should validate linked account belongs to user', async () => {
      // Arrange
      const updateWithAccount = {
        ...updateInput,
        linkedAccountId: 'new-account-id',
      };
      prismaService.debt.findFirst.mockResolvedValue(mockDebt as any);
      // Account lookup is scoped to the user, so another user's account is not found
      prismaService.account.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.update(mockDebtId, mockUserId, updateWithAccount),
      ).rejects.toThrow(NotFoundError);
      expect(prismaService.account.findFirst).toHaveBeenCalledWith({
        where: { id: 'new-account-id', userId: mockUserId },
      });
      expect(prismaService.debt.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should successfully delete debt without payments', async () => {
      // Arrange
      const debtWithoutPayments = { ...mockDebt, payments: [] };
      prismaService.debt.findFirst.mockResolvedValue(
        debtWithoutPayments as any,
      );
      prismaService.debt.delete.mockResolvedValue(debtWithoutPayments as any);

      // Act
      const result = await service.delete(mockDebtId, mockUserId);

      // Assert
      expect(prismaService.debt.findFirst).toHaveBeenCalledWith({
        where: { id: mockDebtId, userId: mockUserId },
        include: { payments: true },
      });
      expect(prismaService.debt.delete).toHaveBeenCalledWith({
        where: { id: mockDebtId },
      });
      expect(result).toBe(true);
    });

    it('should throw ValidationError when debt has payments', async () => {
      // Arrange
      prismaService.debt.findFirst.mockResolvedValue(mockDebt as any);

      // Act & Assert
      await expect(service.delete(mockDebtId, mockUserId)).rejects.toThrow(
        ValidationError,
      );
      expect(prismaService.debt.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError when debt not found', async () => {
      // Arrange
      prismaService.debt.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.delete('non-existent', mockUserId)).rejects.toThrow(
        NotFoundError,
      );
      expect(prismaService.debt.delete).not.toHaveBeenCalled();
    });
  });

  describe('createPayment', () => {
    const paymentInput = {
      debtId: mockDebtId,
      transactionId: mockTransactionId,
      amount: 250.0,
      date: new Date('2024-02-01'),
    };

    it('should successfully create a payment', async () => {
      // Arrange
      prismaService.debt.findFirst.mockResolvedValue(mockDebt as any);
      prismaService.transaction.findFirst.mockResolvedValue({
        id: mockTransactionId,
        userId: mockUserId,
      } as any);

      const createdPayment = { id: 'payment-2', ...paymentInput };
      prismaService.debtPayment.create.mockResolvedValue(createdPayment as any);

      // Act
      const result = await service.createPayment(mockUserId, paymentInput);

      // Assert
      expect(prismaService.debt.findFirst).toHaveBeenCalledWith({
        where: { id: mockDebtId, userId: mockUserId },
        include: { payments: true },
      });
      expect(prismaService.transaction.findFirst).toHaveBeenCalledWith({
        where: { id: mockTransactionId, userId: mockUserId },
      });
      expect(prismaService.debtPayment.create).toHaveBeenCalledWith({
        data: paymentInput,
      });
      expect(result).toEqual({
        id: 'payment-2',
        debtId: mockDebtId,
        transactionId: mockTransactionId,
        amount: 250,
        date: paymentInput.date,
      });
    });

    it('should allow a payment equal to the remaining balance', async () => {
      // Arrange
      prismaService.debt.findFirst.mockResolvedValue(mockDebt as any);
      prismaService.transaction.findFirst.mockResolvedValue({
        id: mockTransactionId,
      } as any);
      prismaService.debtPayment.create.mockResolvedValue({
        id: 'payment-2',
        ...paymentInput,
        amount: 4800,
      } as any);

      // Act
      const result = await service.createPayment(mockUserId, {
        ...paymentInput,
        amount: 4800, // 5000 principal - 200 already paid
      });

      // Assert
      expect(result.amount).toBe(4800);
    });

    it('should throw NotFoundError when debt not found', async () => {
      // Arrange
      prismaService.debt.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.createPayment(mockUserId, paymentInput),
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when transaction not found', async () => {
      // Arrange
      prismaService.debt.findFirst.mockResolvedValue(mockDebt as any);
      prismaService.transaction.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.createPayment(mockUserId, paymentInput),
      ).rejects.toThrow(NotFoundError);
      expect(prismaService.debtPayment.create).not.toHaveBeenCalled();
    });

    it('should throw DebtOverpaymentError when payment exceeds remaining balance', async () => {
      // Arrange
      prismaService.debt.findFirst.mockResolvedValue(mockDebt as any);
      prismaService.transaction.findFirst.mockResolvedValue({
        id: mockTransactionId,
      } as any);

      // Act & Assert
      await expect(
        service.createPayment(mockUserId, {
          ...paymentInput,
          amount: 4800.01,
        }),
      ).rejects.toThrow(DebtOverpaymentError);
      expect(prismaService.debtPayment.create).not.toHaveBeenCalled();
    });

    it('should validate positive payment amount', async () => {
      // Arrange
      const negativePayment = { ...paymentInput, amount: -100.0 };
      prismaService.debt.findFirst.mockResolvedValue(mockDebt as any);
      prismaService.transaction.findFirst.mockResolvedValue({
        id: mockTransactionId,
      } as any);

      // Act & Assert
      await expect(
        service.createPayment(mockUserId, negativePayment),
      ).rejects.toThrow(ValidationError);
    });

    it('should propagate unique constraint errors (transaction already used)', async () => {
      // Arrange
      prismaService.debt.findFirst.mockResolvedValue(mockDebt as any);
      prismaService.transaction.findFirst.mockResolvedValue({
        id: mockTransactionId,
      } as any);
      prismaService.debtPayment.create.mockRejectedValue(
        new Error('Unique constraint violation'),
      );

      // Act & Assert
      await expect(
        service.createPayment(mockUserId, {
          ...paymentInput,
          amount: 100.0,
        }),
      ).rejects.toThrow('Unique constraint violation');
    });
  });

  describe('getDebtSummary', () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date('2024-01-01T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should aggregate totals and build sorted payoff projections', async () => {
      // Arrange
      prismaService.debt.findMany.mockResolvedValue([
        {
          ...mockDebt,
          id: 'debt-long',
          name: 'Long',
          principal: 1200,
          interestRateAnnual: null,
          minPaymentAmount: 100,
          payments: [],
        },
        {
          ...mockDebt,
          id: 'debt-short',
          name: 'Short',
          principal: 600,
          interestRateAnnual: null,
          minPaymentAmount: 100,
          payments: [{ ...mockPayment, amount: 300 }],
        },
        {
          ...mockDebt,
          id: 'debt-no-min',
          name: 'No minimum',
          principal: 1000,
          interestRateAnnual: null,
          minPaymentAmount: null,
          payments: [],
        },
      ] as any);

      // Act
      const result = await service.getDebtSummary(mockUserId);

      // Assert
      expect(prismaService.debt.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        include: { payments: true },
      });
      expect(result.totalDebt).toBe(2800);
      expect(result.totalPaid).toBe(300);
      expect(result.totalRemaining).toBe(2500);
      expect(result.totalMonthlyPayments).toBe(200);
      // Debts without a minimum payment get no projection
      expect(result.payoffProjections.map((p) => p.debtId)).toEqual([
        'debt-short',
        'debt-long',
      ]);
      expect(result.payoffProjections[0]).toEqual(
        expect.objectContaining({
          debtName: 'Short',
          currentBalance: 300,
          monthlyPayment: 100,
          totalInterest: 0,
        }),
      );
    });

    it('should skip projections for fully paid debts', async () => {
      // Arrange
      prismaService.debt.findMany.mockResolvedValue([
        {
          ...mockDebt,
          principal: 200,
          payments: [mockPayment],
        },
      ] as any);

      // Act
      const result = await service.getDebtSummary(mockUserId);

      // Assert
      expect(result.totalRemaining).toBe(0);
      expect(result.payoffProjections).toEqual([]);
    });

    it('should return zeroed summary when user has no debts', async () => {
      // Arrange
      prismaService.debt.findMany.mockResolvedValue([]);

      // Act
      const result = await service.getDebtSummary(mockUserId);

      // Assert
      expect(result).toEqual({
        totalDebt: 0,
        totalPaid: 0,
        totalRemaining: 0,
        totalMonthlyPayments: 0,
        payoffProjections: [],
      });
    });
  });

  describe('calculatePayoffStrategy', () => {
    const highInterestBigDebt = {
      ...mockDebt,
      id: 'debt-high',
      name: 'High interest',
      principal: 5000,
      interestRateAnnual: 24,
      minPaymentAmount: 200,
      payments: [],
    };
    const lowInterestSmallDebt = {
      ...mockDebt,
      id: 'debt-low',
      name: 'Low interest',
      principal: 1000,
      interestRateAnnual: 0,
      minPaymentAmount: 50,
      payments: [],
    };

    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date('2024-01-01T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should prioritize highest interest rate with the avalanche strategy', async () => {
      // Arrange
      prismaService.debt.findMany.mockResolvedValue([
        lowInterestSmallDebt,
        highInterestBigDebt,
      ] as any);

      // Act
      const result = await service.calculatePayoffStrategy(mockUserId, {
        debtIds: ['debt-low', 'debt-high'],
        extraPayment: 100,
        strategy: 'avalanche',
      });

      // Assert
      expect(prismaService.debt.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId, id: { in: ['debt-low', 'debt-high'] } },
        include: { payments: true },
      });
      expect(result.map((p) => p.debtId)).toEqual(['debt-high', 'debt-low']);
      // Extra payment goes to the priority debt...
      expect(result[0].monthlyPayment).toBe(300);
      // ...then the priority debt's minimum rolls over to the next one
      expect(result[1].monthlyPayment).toBe(50 + 100 + 200);
    });

    it('should prioritize lowest balance with the snowball strategy', async () => {
      // Arrange
      prismaService.debt.findMany.mockResolvedValue([
        highInterestBigDebt,
        lowInterestSmallDebt,
      ] as any);

      // Act
      const result = await service.calculatePayoffStrategy(mockUserId, {
        debtIds: ['debt-high', 'debt-low'],
        extraPayment: 100,
        strategy: 'snowball',
      });

      // Assert
      expect(result.map((p) => p.debtId)).toEqual(['debt-low', 'debt-high']);
      expect(result[0]).toEqual(
        expect.objectContaining({
          currentBalance: 1000,
          monthlyPayment: 150,
          totalInterest: 0,
        }),
      );
      // 1000 / 150 = 6.67 months -> payoff 7 months out
      const expectedPayoff = new Date();
      expectedPayoff.setMonth(expectedPayoff.getMonth() + 7);
      expect(result[0].payoffDate).toEqual(expectedPayoff);
      expect(result[0].payoffDate.getMonth()).toBe(7); // August
    });

    it('should exclude debts that are already paid off', async () => {
      // Arrange
      prismaService.debt.findMany.mockResolvedValue([
        {
          ...lowInterestSmallDebt,
          payments: [{ ...mockPayment, amount: 1000 }],
        },
        highInterestBigDebt,
      ] as any);

      // Act
      const result = await service.calculatePayoffStrategy(mockUserId, {
        debtIds: ['debt-low', 'debt-high'],
        extraPayment: 100,
        strategy: 'snowball',
      });

      // Assert
      expect(result.map((p) => p.debtId)).toEqual(['debt-high']);
    });

    it('should throw NotFoundError when any debt is missing', async () => {
      // Arrange
      prismaService.debt.findMany.mockResolvedValue([
        highInterestBigDebt,
      ] as any);

      // Act & Assert
      await expect(
        service.calculatePayoffStrategy(mockUserId, {
          debtIds: ['debt-high', 'non-existent'],
          extraPayment: 100,
          strategy: 'avalanche',
        }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('calculateMonthsToPayoff', () => {
    it('should divide balance by payment when there is no interest', () => {
      expect(service['calculateMonthsToPayoff'](1000, 100, 0)).toBe(10);
      expect(service['calculateMonthsToPayoff'](50, 25, 0)).toBe(2);
    });

    it('should use the amortization formula when interest applies', () => {
      // Arrange
      const balance = 1000;
      const payment = 100;
      const monthlyRate = 0.01;

      // Act
      const result = service['calculateMonthsToPayoff'](
        balance,
        payment,
        monthlyRate,
      );

      // Assert
      const expected =
        Math.log(1 + (balance * monthlyRate) / payment) /
        Math.log(1 + monthlyRate);
      expect(result).toBeCloseTo(expected, 10);
      expect(result).toBeGreaterThan(0);
    });

    it('should return the 999 sentinel when payment does not cover interest', () => {
      expect(service['calculateMonthsToPayoff'](10000, 100, 0.01)).toBe(999);
      expect(service['calculateMonthsToPayoff'](10000, 50, 0.01)).toBe(999);
    });
  });

  describe('mapDebt', () => {
    it('should correctly map debt with all fields', () => {
      // Act
      const result = service['mapDebt'](
        mockDebt as any,
        mockDebt.payments as any,
        200,
      );

      // Assert
      expect(result).toEqual({
        id: mockDebt.id,
        userId: mockDebt.userId,
        name: mockDebt.name,
        kind: mockDebt.kind,
        principal: Number(mockDebt.principal),
        interestRateAnnual: Number(mockDebt.interestRateAnnual),
        minPaymentAmount: Number(mockDebt.minPaymentAmount),
        startDate: mockDebt.startDate,
        dueDate: mockDebt.dueDate,
        linkedAccountId: mockDebt.linkedAccountId,
        createdAt: mockDebt.createdAt,
        remainingBalance: 4800,
        totalPaid: 200,
        monthlyPayment: Number(mockDebt.minPaymentAmount),
      });
    });

    it('should map null optional fields to undefined', () => {
      // Arrange
      const debtWithNulls = {
        ...mockDebt,
        interestRateAnnual: null,
        minPaymentAmount: null,
        startDate: null,
        dueDate: null,
        linkedAccountId: null,
      };

      // Act
      const result = service['mapDebt'](debtWithNulls as any, [], 0);

      // Assert
      expect(result.interestRateAnnual).toBeUndefined();
      expect(result.minPaymentAmount).toBeUndefined();
      expect(result.monthlyPayment).toBeUndefined();
      expect(result.startDate).toBeUndefined();
      expect(result.dueDate).toBeUndefined();
      expect(result.linkedAccountId).toBeUndefined();
    });

    it('should never report a negative remaining balance', () => {
      // Act
      const result = service['mapDebt'](mockDebt as any, [], 6000);

      // Assert
      expect(result.remainingBalance).toBe(0);
      expect(result.totalPaid).toBe(6000);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle very large debt amounts', async () => {
      // Arrange
      const largeDebtInput = {
        name: 'Mortgage',
        kind: DebtKind.loan,
        principal: 999999999.99,
        interestRateAnnual: 3.5,
        minPaymentAmount: 5000.0,
      };

      const largeDebt = { ...mockDebt, ...largeDebtInput };
      prismaService.debt.create.mockResolvedValue(largeDebt as any);

      // Act
      const result = await service.create(mockUserId, largeDebtInput);

      // Assert
      expect(result.principal).toBe(largeDebtInput.principal);
    });
  });
});
