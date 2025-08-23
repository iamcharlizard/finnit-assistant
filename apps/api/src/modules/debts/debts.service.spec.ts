import { Test, TestingModule } from '@nestjs/testing';
import { DebtsService } from './debts.service';
import { PrismaService } from '../../services/prisma.service';
import { NotFoundError, ValidationError } from '../../common/exceptions/graphql-error.exception';
import { DebtKind } from '@finnit/database';

describe('DebtsService', () => {
  let service: DebtsService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockUserId = 'user-1';
  const mockDebtId = 'debt-1';
  const mockTransactionId = 'transaction-1';
  const mockAccountId = 'account-1';

  const mockDebt = {
    id: mockDebtId,
    userId: mockUserId,
    name: 'Credit Card Debt',
    kind: DebtKind.card,
    principal: 5000.00,
    interestRateAnnual: 18.5,
    minPaymentAmount: 150.00,
    startDate: new Date('2024-01-01'),
    dueDate: new Date('2026-01-01'),
    linkedAccountId: mockAccountId,
    createdAt: new Date('2024-01-01'),
    payments: [
      {
        id: 'payment-1',
        debtId: mockDebtId,
        transactionId: mockTransactionId,
        amount: 200.00,
        date: new Date('2024-01-15'),
      },
    ],
  };

  beforeEach(async () => {
    const mockPrismaService = {
      debt: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      debtPayment: {
        create: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
        aggregate: jest.fn(),
      },
      transaction: {
        findFirst: jest.fn(),
      },
      account: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DebtsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<DebtsService>(DebtsService);
    prismaService = module.get(PrismaService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    const createInput = {
      name: 'Personal Loan',
      kind: DebtKind.loan,
      principal: 15000.00,
      interestRateAnnual: 7.5,
      minPaymentAmount: 300.00,
      startDate: new Date('2024-01-01'),
      dueDate: new Date('2029-01-01'),
      linkedAccountId: mockAccountId,
    };

    it('should successfully create a new debt', async () => {
      // Arrange
      const mockAccount = { id: mockAccountId, userId: mockUserId };
      prismaService.account.findFirst.mockResolvedValue(mockAccount as any);
      
      const expectedDebt = { ...mockDebt, ...createInput };
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
        include: { payments: true, linkedAccount: true },
      });
      expect(result.principal).toBe(Number(createInput.principal));
    });

    it('should create debt without linked account', async () => {
      // Arrange
      const inputWithoutAccount = { ...createInput };
      delete inputWithoutAccount.linkedAccountId;
      
      const debtWithoutAccount = { ...mockDebt, linkedAccountId: null };
      prismaService.debt.create.mockResolvedValue(debtWithoutAccount as any);

      // Act
      await service.create(mockUserId, inputWithoutAccount);

      // Assert
      expect(prismaService.account.findFirst).not.toHaveBeenCalled();
      expect(prismaService.debt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          linkedAccountId: undefined,
        }),
        include: { payments: true, linkedAccount: true },
      });
    });

    it('should throw NotFoundError when linked account not found', async () => {
      // Arrange
      prismaService.account.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.create(mockUserId, createInput)).rejects.toThrow(NotFoundError);
      expect(prismaService.debt.create).not.toHaveBeenCalled();
    });

    it('should validate positive principal amount', async () => {
      // Arrange
      const invalidInput = { ...createInput, principal: -1000.00 };

      // Act & Assert
      await expect(service.create(mockUserId, invalidInput)).rejects.toThrow(ValidationError);
    });

    it('should validate non-negative interest rate', async () => {
      // Arrange
      const invalidInput = { ...createInput, interestRateAnnual: -5.0 };

      // Act & Assert
      await expect(service.create(mockUserId, invalidInput)).rejects.toThrow(ValidationError);
    });

    it('should validate due date is after start date', async () => {
      // Arrange
      const invalidInput = {
        ...createInput,
        startDate: new Date('2024-12-31'),
        dueDate: new Date('2024-01-01'), // Before start date
      };

      // Act & Assert
      await expect(service.create(mockUserId, invalidInput)).rejects.toThrow(ValidationError);
    });
  });

  describe('findMany', () => {
    it('should return all debts for user', async () => {
      // Arrange
      const mockDebts = [mockDebt, { ...mockDebt, id: 'debt-2', name: 'Student Loan' }];
      prismaService.debt.findMany.mockResolvedValue(mockDebts as any);

      // Act
      const result = await service.findMany(mockUserId);

      // Assert
      expect(prismaService.debt.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        include: { payments: true, linkedAccount: true },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no debts exist', async () => {
      // Arrange
      prismaService.debt.findMany.mockResolvedValue([]);

      // Act
      const result = await service.findMany(mockUserId);

      // Assert
      expect(result).toEqual([]);
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
        include: { payments: { include: { transaction: true } }, linkedAccount: true },
      });
      expect(result.id).toBe(mockDebtId);
    });

    it('should throw NotFoundError when debt not found', async () => {
      // Arrange
      prismaService.debt.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findById('non-existent', mockUserId)).rejects.toThrow(NotFoundError);
    });
  });

  describe('update', () => {
    const updateInput = {
      name: 'Updated Debt Name',
      minPaymentAmount: 200.00,
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
      });
      expect(prismaService.debt.update).toHaveBeenCalledWith({
        where: { id: mockDebtId },
        data: updateInput,
        include: { payments: true, linkedAccount: true },
      });
      expect(result.name).toBe(updateInput.name);
    });

    it('should throw NotFoundError when debt not found', async () => {
      // Arrange
      prismaService.debt.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.update('non-existent', mockUserId, updateInput)).rejects.toThrow(NotFoundError);
      expect(prismaService.debt.update).not.toHaveBeenCalled();
    });

    it('should validate linked account belongs to user', async () => {
      // Arrange
      const updateWithAccount = { ...updateInput, linkedAccountId: 'new-account-id' };
      const wrongUserAccount = { id: 'new-account-id', userId: 'different-user' };
      
      prismaService.debt.findFirst.mockResolvedValue(mockDebt as any);
      prismaService.account.findFirst.mockResolvedValue(wrongUserAccount as any);

      // Act & Assert
      await expect(service.update(mockDebtId, mockUserId, updateWithAccount)).rejects.toThrow(NotFoundError);
    });
  });

  describe('delete', () => {
    it('should successfully delete debt without payments', async () => {
      // Arrange
      const debtWithoutPayments = { ...mockDebt, payments: [] };
      prismaService.debt.findFirst.mockResolvedValue(debtWithoutPayments as any);
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
      await expect(service.delete(mockDebtId, mockUserId)).rejects.toThrow(ValidationError);
      expect(prismaService.debt.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError when debt not found', async () => {
      // Arrange
      prismaService.debt.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.delete('non-existent', mockUserId)).rejects.toThrow(NotFoundError);
      expect(prismaService.debt.delete).not.toHaveBeenCalled();
    });
  });

  describe('addPayment', () => {
    const paymentInput = {
      debtId: mockDebtId,
      transactionId: mockTransactionId,
      amount: 250.00,
      date: new Date('2024-02-01'),
    };

    it('should successfully add payment', async () => {
      // Arrange
      const mockTransaction = {
        id: mockTransactionId,
        userId: mockUserId,
        amount: 250.00,
        type: 'expense',
      };

      prismaService.debt.findFirst.mockResolvedValue(mockDebt as any);
      prismaService.transaction.findFirst.mockResolvedValue(mockTransaction as any);
      
      const createdPayment = {
        id: 'payment-2',
        ...paymentInput,
      };

      prismaService.debtPayment.create.mockResolvedValue(createdPayment as any);

      // Act
      const result = await service.addPayment(mockUserId, paymentInput);

      // Assert
      expect(prismaService.debt.findFirst).toHaveBeenCalledWith({
        where: { id: mockDebtId, userId: mockUserId },
      });
      expect(prismaService.transaction.findFirst).toHaveBeenCalledWith({
        where: { id: mockTransactionId, userId: mockUserId },
      });
      expect(prismaService.debtPayment.create).toHaveBeenCalledWith({
        data: paymentInput,
        include: { transaction: true },
      });
      expect(result.amount).toBe(Number(createdPayment.amount));
    });

    it('should throw NotFoundError when debt not found', async () => {
      // Arrange
      prismaService.debt.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.addPayment(mockUserId, paymentInput)).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when transaction not found', async () => {
      // Arrange
      prismaService.debt.findFirst.mockResolvedValue(mockDebt as any);
      prismaService.transaction.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.addPayment(mockUserId, paymentInput)).rejects.toThrow(NotFoundError);
    });

    it('should validate positive payment amount', async () => {
      // Arrange
      const negativePayment = { ...paymentInput, amount: -100.00 };
      prismaService.debt.findFirst.mockResolvedValue(mockDebt as any);

      // Act & Assert
      await expect(service.addPayment(mockUserId, negativePayment)).rejects.toThrow(ValidationError);
    });
  });

  describe('calculatePayoffSchedule', () => {
    it('should calculate payoff schedule with minimum payments', async () => {
      // Arrange
      prismaService.debt.findFirst.mockResolvedValue(mockDebt as any);
      prismaService.debtPayment.aggregate.mockResolvedValue({
        _sum: { amount: 400.00 }, // Total payments made
      } as any);

      // Act
      const result = await service.calculatePayoffSchedule(mockDebtId, mockUserId);

      // Assert
      expect(result).toEqual(expect.objectContaining({
        debtId: mockDebt.id,
        currentBalance: mockDebt.principal - 400.00, // Principal minus payments
        monthlyPayment: mockDebt.minPaymentAmount,
        totalInterest: expect.any(Number),
        totalPayments: expect.any(Number),
        payoffDate: expect.any(Date),
        monthsRemaining: expect.any(Number),
      }));
    });

    it('should calculate payoff schedule with custom payment amount', async () => {
      // Arrange
      const customPayment = 300.00;
      prismaService.debt.findFirst.mockResolvedValue(mockDebt as any);
      prismaService.debtPayment.aggregate.mockResolvedValue({
        _sum: { amount: 0 },
      } as any);

      // Act
      const result = await service.calculatePayoffSchedule(mockDebtId, mockUserId, customPayment);

      // Assert
      expect(result.monthlyPayment).toBe(customPayment);
      expect(result.monthsRemaining).toBeLessThan(
        mockDebt.principal / mockDebt.minPaymentAmount! // Should be faster with higher payment
      );
    });

    it('should handle debt without interest rate', async () => {
      // Arrange
      const debtWithoutInterest = { ...mockDebt, interestRateAnnual: null };
      prismaService.debt.findFirst.mockResolvedValue(debtWithoutInterest as any);
      prismaService.debtPayment.aggregate.mockResolvedValue({
        _sum: { amount: 0 },
      } as any);

      // Act
      const result = await service.calculatePayoffSchedule(mockDebtId, mockUserId);

      // Assert
      expect(result.totalInterest).toBe(0);
      expect(result.monthsRemaining).toBe(
        Math.ceil(mockDebt.principal / mockDebt.minPaymentAmount!)
      );
    });

    it('should throw NotFoundError when debt not found', async () => {
      // Arrange
      prismaService.debt.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.calculatePayoffSchedule('non-existent', mockUserId)).rejects.toThrow(NotFoundError);
    });

    it('should handle fully paid off debt', async () => {
      // Arrange
      prismaService.debt.findFirst.mockResolvedValue(mockDebt as any);
      prismaService.debtPayment.aggregate.mockResolvedValue({
        _sum: { amount: mockDebt.principal }, // Fully paid
      } as any);

      // Act
      const result = await service.calculatePayoffSchedule(mockDebtId, mockUserId);

      // Assert
      expect(result.currentBalance).toBe(0);
      expect(result.monthsRemaining).toBe(0);
      expect(result.payoffDate).toEqual(expect.any(Date));
    });
  });

  describe('getPaymentHistory', () => {
    it('should return payment history with pagination', async () => {
      // Arrange
      const mockPayments = [
        {
          id: 'payment-1',
          debtId: mockDebtId,
          amount: 200.00,
          date: new Date('2024-01-15'),
          transactionId: mockTransactionId,
          transaction: {
            id: mockTransactionId,
            description: 'Credit card payment',
          },
        },
      ];

      prismaService.debt.findFirst.mockResolvedValue(mockDebt as any);
      prismaService.debtPayment.findMany.mockResolvedValue(mockPayments as any);

      // Act
      const result = await service.getPaymentHistory(mockDebtId, mockUserId, { limit: 10, offset: 0 });

      // Assert
      expect(prismaService.debtPayment.findMany).toHaveBeenCalledWith({
        where: { debtId: mockDebtId },
        include: { transaction: true },
        orderBy: { date: 'desc' },
        take: 10,
        skip: 0,
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(expect.objectContaining({
        id: 'payment-1',
        amount: Number(mockPayments[0].amount),
      }));
    });

    it('should throw NotFoundError when debt not found', async () => {
      // Arrange
      prismaService.debt.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getPaymentHistory('non-existent', mockUserId)).rejects.toThrow(NotFoundError);
    });
  });

  describe('calculateInterest', () => {
    it('should calculate compound interest correctly', async () => {
      // Arrange
      const principal = 1000.00;
      const annualRate = 12.0; // 12% annual
      const months = 12;

      // Act
      const result = service['calculateInterest'](principal, annualRate, months);

      // Assert
      const monthlyRate = annualRate / 100 / 12;
      const expectedInterest = principal * Math.pow(1 + monthlyRate, months) - principal;
      expect(result).toBeCloseTo(expectedInterest, 2);
    });

    it('should return zero interest for zero rate', () => {
      // Act
      const result = service['calculateInterest'](1000.00, 0, 12);

      // Assert
      expect(result).toBe(0);
    });

    it('should handle fractional months', () => {
      // Act
      const result = service['calculateInterest'](1000.00, 12.0, 6.5);

      // Assert
      expect(result).toBeGreaterThan(0);
      expect(typeof result).toBe('number');
    });
  });

  describe('mapDebt', () => {
    it('should correctly map debt with all fields', () => {
      // Act
      const result = service['mapDebt'](mockDebt as any);

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
        payments: mockDebt.payments.map((payment) => ({
          id: payment.id,
          debtId: payment.debtId,
          transactionId: payment.transactionId,
          amount: Number(payment.amount),
          date: payment.date,
        })),
      });
    });

    it('should handle debt with null optional fields', () => {
      // Arrange
      const debtWithNulls = {
        ...mockDebt,
        interestRateAnnual: null,
        minPaymentAmount: null,
        dueDate: null,
        linkedAccountId: null,
      };

      // Act
      const result = service['mapDebt'](debtWithNulls as any);

      // Assert
      expect(result.interestRateAnnual).toBeNull();
      expect(result.minPaymentAmount).toBeNull();
      expect(result.dueDate).toBeNull();
      expect(result.linkedAccountId).toBeNull();
    });

    it('should handle debt without payments', () => {
      // Arrange
      const debtWithoutPayments = { ...mockDebt, payments: [] };

      // Act
      const result = service['mapDebt'](debtWithoutPayments as any);

      // Assert
      expect(result.payments).toEqual([]);
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
        minPaymentAmount: 5000.00,
      };

      const largeDebt = { ...mockDebt, ...largeDebtInput };
      prismaService.debt.create.mockResolvedValue(largeDebt as any);

      // Act
      const result = await service.create(mockUserId, largeDebtInput);

      // Assert
      expect(result.principal).toBe(largeDebtInput.principal);
    });

    it('should handle payoff calculation for very small balances', async () => {
      // Arrange
      const smallDebt = { ...mockDebt, principal: 50.00, minPaymentAmount: 25.00 };
      prismaService.debt.findFirst.mockResolvedValue(smallDebt as any);
      prismaService.debtPayment.aggregate.mockResolvedValue({
        _sum: { amount: 0 },
      } as any);

      // Act
      const result = await service.calculatePayoffSchedule(mockDebtId, mockUserId);

      // Assert
      expect(result.monthsRemaining).toBe(2);
      expect(result.currentBalance).toBe(50.00);
    });

    it('should handle payment amount larger than debt balance', async () => {
      // Arrange
      const overpaymentInput = {
        debtId: mockDebtId,
        transactionId: mockTransactionId,
        amount: mockDebt.principal + 1000.00, // More than debt balance
        date: new Date(),
      };

      const mockTransaction = { id: mockTransactionId, userId: mockUserId };
      prismaService.debt.findFirst.mockResolvedValue(mockDebt as any);
      prismaService.transaction.findFirst.mockResolvedValue(mockTransaction as any);
      
      // This would be handled at the business logic level
      prismaService.debtPayment.create.mockResolvedValue({
        id: 'payment-2',
        ...overpaymentInput,
      } as any);

      // Act - Should still succeed but application logic might cap the payment
      const result = await service.addPayment(mockUserId, overpaymentInput);

      // Assert
      expect(result).toBeDefined();
    });

    it('should handle concurrent payment additions', async () => {
      // Arrange
      prismaService.debt.findFirst.mockResolvedValue(mockDebt as any);
      prismaService.transaction.findFirst.mockResolvedValue({ id: mockTransactionId } as any);
      prismaService.debtPayment.create.mockRejectedValue(new Error('Unique constraint violation'));

      // Act & Assert
      await expect(service.addPayment(mockUserId, {
        debtId: mockDebtId,
        transactionId: mockTransactionId,
        amount: 100.00,
        date: new Date(),
      })).rejects.toThrow('Unique constraint violation');
    });

    it('should validate reasonable interest rates', async () => {
      // Arrange
      const extremeRateInput = {
        name: 'Loan Shark',
        kind: DebtKind.loan,
        principal: 1000.00,
        interestRateAnnual: 999.99, // Unreasonably high
      };

      // Act & Assert - Should validate reasonable ranges
      await expect(service.create(mockUserId, extremeRateInput)).rejects.toThrow(ValidationError);
    });
  });
});