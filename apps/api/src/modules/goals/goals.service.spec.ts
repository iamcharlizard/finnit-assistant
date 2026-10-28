import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { GoalsService } from './goals.service';
import { PrismaService } from '../../services/prisma.service';
import { Prisma } from '@finnit/database';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  GoalAlreadyReachedError,
} from '../../common/exceptions/graphql-error.exception';

const uniqueViolation = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint', {
    code: 'P2002',
    clientVersion: 'test',
  });

/** Makes `$transaction(callback)` run the callback against `tx`. */
const runTransactionWith = (tx: unknown) =>
  ((callback: (client: unknown) => unknown) =>
    Promise.resolve(callback(tx))) as never;

describe('GoalsService', () => {
  let service: GoalsService;
  let prismaService: DeepMockProxy<PrismaService>;

  const mockUserId = 'user-1';
  const mockGoalId = 'goal-1';
  const mockTransactionId = 'transaction-1';

  const mockGoal = {
    id: mockGoalId,
    userId: mockUserId,
    name: 'Emergency Fund',
    targetAmount: 10000.0,
    currentAmount: 3000.0,
    currency: 'USD',
    dueDate: new Date('2024-12-31'),
    createdAt: new Date('2024-01-01'),
  };

  const mockContribution = {
    id: 'contribution-1',
    goalId: mockGoalId,
    transactionId: mockTransactionId,
    amount: 500.0,
    date: new Date('2024-01-15'),
  };

  const mockTxWith = (overrides: Record<string, unknown> = {}) => ({
    goalContribution: {
      create: jest.fn(),
      delete: jest.fn(),
    },
    goal: {
      update: jest.fn(),
    },
    ...overrides,
  });

  beforeEach(async () => {
    prismaService = mockDeep<PrismaService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoalsService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    service = module.get<GoalsService>(GoalsService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    const createInput = {
      name: 'Vacation Fund',
      targetAmount: 5000.0,
      currency: 'USD',
      dueDate: new Date('2024-06-30'),
    };

    it('should successfully create a new goal', async () => {
      // Arrange
      const expectedGoal = { ...mockGoal, ...createInput, currentAmount: 0 };
      prismaService.goal.create.mockResolvedValue(expectedGoal as any);

      // Act
      const result = await service.create(mockUserId, createInput);

      // Assert
      expect(prismaService.goal.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          name: createInput.name,
          targetAmount: createInput.targetAmount,
          currency: createInput.currency,
          dueDate: createInput.dueDate,
        },
      });
      expect(result).toEqual(
        expect.objectContaining({
          name: createInput.name,
          targetAmount: Number(createInput.targetAmount),
          currentAmount: 0,
        }),
      );
    });

    it('should create goal without due date', async () => {
      // Arrange
      const inputWithoutDueDate: any = { ...createInput };
      delete inputWithoutDueDate.dueDate;

      const goalWithoutDueDate = { ...mockGoal, dueDate: null };
      prismaService.goal.create.mockResolvedValue(goalWithoutDueDate as any);

      // Act
      const result = await service.create(mockUserId, inputWithoutDueDate);

      // Assert
      expect(prismaService.goal.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          dueDate: undefined,
        }),
      });
      expect(result.dueDate).toBeUndefined();
    });

    it('refuses a target amount that is not positive', async () => {
      await expect(
        service.create(mockUserId, { ...createInput, targetAmount: 0 }),
      ).rejects.toThrow(ValidationError);
      expect(prismaService.goal.create).not.toHaveBeenCalled();
    });

    it('refuses a blank name', async () => {
      await expect(
        service.create(mockUserId, { ...createInput, name: '   ' }),
      ).rejects.toThrow(ValidationError);
      expect(prismaService.goal.create).not.toHaveBeenCalled();
    });

    it('maps a repeated name to a ConflictError', async () => {
      prismaService.goal.create.mockRejectedValue(uniqueViolation());

      await expect(service.create(mockUserId, createInput)).rejects.toThrow(
        'A goal with this name already exists',
      );
      await expect(service.create(mockUserId, createInput)).rejects.toThrow(
        ConflictError,
      );
    });

    it('should handle goal creation errors', async () => {
      // Arrange
      prismaService.goal.create.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(service.create(mockUserId, createInput)).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('findMany', () => {
    it('should return all goals for user', async () => {
      // Arrange
      const mockGoals = [
        mockGoal,
        { ...mockGoal, id: 'goal-2', name: 'Car Fund' },
      ];
      prismaService.goal.findMany.mockResolvedValue(mockGoals as any);

      // Act
      const result = await service.findMany(mockUserId);

      // Assert
      expect(prismaService.goal.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(2);
      expect(result.map((g) => g.id)).toEqual([mockGoalId, 'goal-2']);
    });

    it('should return empty array when no goals exist', async () => {
      // Arrange
      prismaService.goal.findMany.mockResolvedValue([]);

      // Act
      const result = await service.findMany(mockUserId);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should return goal when found', async () => {
      // Arrange
      prismaService.goal.findFirst.mockResolvedValue(mockGoal as any);

      // Act
      const result = await service.findById(mockGoalId, mockUserId);

      // Assert
      expect(prismaService.goal.findFirst).toHaveBeenCalledWith({
        where: { id: mockGoalId, userId: mockUserId },
      });
      expect(result.id).toBe(mockGoalId);
    });

    it('should throw NotFoundError when goal not found', async () => {
      // Arrange
      prismaService.goal.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.findById('non-existent', mockUserId),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('update', () => {
    const updateInput = {
      name: 'Updated Goal Name',
      targetAmount: 15000.0,
      dueDate: new Date('2025-01-31'),
    };

    it('should successfully update goal', async () => {
      // Arrange
      const existingGoal = { ...mockGoal };
      const updatedGoal = { ...existingGoal, ...updateInput };

      prismaService.goal.findFirst.mockResolvedValue(existingGoal as any);
      prismaService.goal.update.mockResolvedValue(updatedGoal as any);

      // Act
      const result = await service.update(mockGoalId, mockUserId, updateInput);

      // Assert
      expect(prismaService.goal.findFirst).toHaveBeenCalledWith({
        where: { id: mockGoalId, userId: mockUserId },
      });
      expect(prismaService.goal.update).toHaveBeenCalledWith({
        where: { id: mockGoalId },
        data: updateInput,
      });
      expect(result.name).toBe(updateInput.name);
      expect(result.targetAmount).toBe(Number(updateInput.targetAmount));
    });

    it('should throw NotFoundError when goal not found', async () => {
      // Arrange
      prismaService.goal.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.update('non-existent', mockUserId, updateInput),
      ).rejects.toThrow(NotFoundError);
      expect(prismaService.goal.update).not.toHaveBeenCalled();
    });

    it('maps a repeated name to a ConflictError', async () => {
      prismaService.goal.findFirst.mockResolvedValue(mockGoal as any);
      prismaService.goal.update.mockRejectedValue(uniqueViolation());

      await expect(
        service.update(mockGoalId, mockUserId, updateInput),
      ).rejects.toThrow(ConflictError);
    });

    it('clears the due date when given null', async () => {
      prismaService.goal.findFirst.mockResolvedValue(mockGoal as any);
      prismaService.goal.update.mockResolvedValue({
        ...mockGoal,
        dueDate: null,
      } as any);

      const result = await service.update(mockGoalId, mockUserId, {
        dueDate: null,
      } as any);

      expect(prismaService.goal.update).toHaveBeenCalledWith({
        where: { id: mockGoalId },
        data: { dueDate: null },
      });
      expect(result.dueDate).toBeUndefined();
    });

    it('should validate target amount is positive', async () => {
      // Arrange
      const invalidInput = { ...updateInput, targetAmount: -1000.0 };
      prismaService.goal.findFirst.mockResolvedValue(mockGoal as any);

      // Act & Assert
      await expect(
        service.update(mockGoalId, mockUserId, invalidInput),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('delete', () => {
    it('should successfully delete goal without contributions', async () => {
      // Arrange
      prismaService.goal.findFirst.mockResolvedValue({
        ...mockGoal,
        contributions: [],
      } as any);
      prismaService.goal.delete.mockResolvedValue(mockGoal as any);

      // Act
      const result = await service.delete(mockGoalId, mockUserId);

      // Assert
      expect(prismaService.goal.findFirst).toHaveBeenCalledWith({
        where: { id: mockGoalId, userId: mockUserId },
        include: { contributions: true },
      });
      expect(prismaService.goal.delete).toHaveBeenCalledWith({
        where: { id: mockGoalId },
      });
      expect(result).toBe(true);
    });

    it('should throw ValidationError when goal has contributions', async () => {
      // Arrange
      prismaService.goal.findFirst.mockResolvedValue({
        ...mockGoal,
        contributions: [mockContribution],
      } as any);

      // Act & Assert
      await expect(service.delete(mockGoalId, mockUserId)).rejects.toThrow(
        ValidationError,
      );
      expect(prismaService.goal.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError when goal not found', async () => {
      // Arrange
      prismaService.goal.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.delete('non-existent', mockUserId)).rejects.toThrow(
        NotFoundError,
      );
      expect(prismaService.goal.delete).not.toHaveBeenCalled();
    });
  });

  describe('addContribution', () => {
    const contributionInput = {
      goalId: mockGoalId,
      transactionId: mockTransactionId,
      amount: 200.0,
      date: new Date('2024-02-01'),
    };

    it('should successfully add contribution and increment goal amount', async () => {
      // Arrange
      prismaService.goal.findFirst.mockResolvedValue(mockGoal as any);
      prismaService.transaction.findFirst.mockResolvedValue({
        id: mockTransactionId,
        userId: mockUserId,
      } as any);

      const mockTx = mockTxWith();
      mockTx.goalContribution.create.mockResolvedValue({
        id: 'contribution-2',
        ...contributionInput,
      });
      prismaService.$transaction.mockImplementation(runTransactionWith(mockTx));

      // Act
      const result = await service.addContribution(
        mockUserId,
        contributionInput,
      );

      // Assert
      expect(prismaService.goal.findFirst).toHaveBeenCalledWith({
        where: { id: mockGoalId, userId: mockUserId },
      });
      expect(prismaService.transaction.findFirst).toHaveBeenCalledWith({
        where: { id: mockTransactionId, userId: mockUserId },
      });
      expect(mockTx.goalContribution.create).toHaveBeenCalledWith({
        data: {
          goalId: mockGoalId,
          transactionId: mockTransactionId,
          amount: 200.0,
          date: contributionInput.date,
        },
      });
      expect(mockTx.goal.update).toHaveBeenCalledWith({
        where: { id: mockGoalId },
        data: { currentAmount: { increment: 200.0 } },
      });
      expect(result).toEqual({
        id: 'contribution-2',
        goalId: mockGoalId,
        transactionId: mockTransactionId,
        amount: 200,
        date: contributionInput.date,
      });
    });

    it('should throw NotFoundError when goal not found', async () => {
      // Arrange
      prismaService.goal.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.addContribution(mockUserId, contributionInput),
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when transaction not found', async () => {
      // Arrange
      prismaService.goal.findFirst.mockResolvedValue(mockGoal as any);
      prismaService.transaction.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.addContribution(mockUserId, contributionInput),
      ).rejects.toThrow(NotFoundError);
      expect(prismaService.$transaction).not.toHaveBeenCalled();
    });

    it('should throw GoalAlreadyReachedError when goal is already completed', async () => {
      // Arrange
      prismaService.goal.findFirst.mockResolvedValue({
        ...mockGoal,
        currentAmount: mockGoal.targetAmount,
      } as any);

      // Act & Assert
      await expect(
        service.addContribution(mockUserId, contributionInput),
      ).rejects.toThrow(GoalAlreadyReachedError);
      expect(prismaService.$transaction).not.toHaveBeenCalled();
    });

    it('should throw ValidationError for negative contribution amount', async () => {
      // Arrange
      const negativeInput = { ...contributionInput, amount: -100.0 };
      prismaService.goal.findFirst.mockResolvedValue(mockGoal as any);

      // Act & Assert
      await expect(
        service.addContribution(mockUserId, negativeInput),
      ).rejects.toThrow(ValidationError);
    });

    it('should handle contribution without transaction', async () => {
      // Arrange
      const manualContribution: any = { ...contributionInput };
      delete manualContribution.transactionId;

      prismaService.goal.findFirst.mockResolvedValue(mockGoal as any);

      const mockTx = mockTxWith();
      mockTx.goalContribution.create.mockResolvedValue({
        id: 'contribution-3',
        ...manualContribution,
        transactionId: null,
      });
      prismaService.$transaction.mockImplementation(runTransactionWith(mockTx));

      // Act
      const result = await service.addContribution(
        mockUserId,
        manualContribution,
      );

      // Assert - Should not validate transaction
      expect(prismaService.transaction.findFirst).not.toHaveBeenCalled();
      expect(result.transactionId).toBeUndefined();
    });
  });

  describe('removeContribution', () => {
    const contributionId = 'contribution-1';

    it('should successfully remove contribution and decrement goal amount', async () => {
      // Arrange
      prismaService.goalContribution.findFirst.mockResolvedValue({
        ...mockContribution,
        goal: { ...mockGoal },
      } as any);

      const mockTx = mockTxWith();
      prismaService.$transaction.mockImplementation(runTransactionWith(mockTx));

      // Act
      const result = await service.removeContribution(
        contributionId,
        mockUserId,
      );

      // Assert
      expect(prismaService.goalContribution.findFirst).toHaveBeenCalledWith({
        where: { id: contributionId, goal: { userId: mockUserId } },
        include: { goal: true },
      });
      expect(mockTx.goalContribution.delete).toHaveBeenCalledWith({
        where: { id: contributionId },
      });
      expect(mockTx.goal.update).toHaveBeenCalledWith({
        where: { id: mockGoalId },
        data: { currentAmount: { decrement: mockContribution.amount } },
      });
      expect(result).toBe(true);
    });

    it('should throw NotFoundError when contribution not found', async () => {
      // Arrange
      prismaService.goalContribution.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.removeContribution('non-existent', mockUserId),
      ).rejects.toThrow(NotFoundError);
      expect(prismaService.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('getProgress', () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date('2024-12-01T00:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should calculate goal progress correctly', async () => {
      // Arrange
      prismaService.goal.findFirst.mockResolvedValue(mockGoal as any);

      // Act
      const result = await service.getProgress(mockGoalId, mockUserId);

      // Assert
      expect(prismaService.goal.findFirst).toHaveBeenCalledWith({
        where: { id: mockGoalId, userId: mockUserId },
      });
      expect(result).toEqual({
        goalId: mockGoal.id,
        percentage: 30,
        remaining: 7000,
        daysRemaining: 30,
        isCompleted: false,
      });
    });

    it('should round percentage to two decimals', async () => {
      // Arrange
      prismaService.goal.findFirst.mockResolvedValue({
        ...mockGoal,
        targetAmount: 3,
        currentAmount: 1,
      } as any);

      // Act
      const result = await service.getProgress(mockGoalId, mockUserId);

      // Assert
      expect(result.percentage).toBe(33.33);
    });

    it('should handle completed and over-funded goals', async () => {
      // Arrange
      prismaService.goal.findFirst.mockResolvedValue({
        ...mockGoal,
        currentAmount: 12000,
      } as any);

      // Act
      const result = await service.getProgress(mockGoalId, mockUserId);

      // Assert
      expect(result.isCompleted).toBe(true);
      expect(result.percentage).toBe(120);
      expect(result.remaining).toBe(0);
    });

    it('should handle goals without due date', async () => {
      // Arrange
      prismaService.goal.findFirst.mockResolvedValue({
        ...mockGoal,
        dueDate: null,
      } as any);

      // Act
      const result = await service.getProgress(mockGoalId, mockUserId);

      // Assert
      expect(result.daysRemaining).toBeUndefined();
    });

    it('should throw NotFoundError when goal not found', async () => {
      // Arrange
      prismaService.goal.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.getProgress('non-existent', mockUserId),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('getContributions', () => {
    it('should return goal contributions ordered by date', async () => {
      // Arrange
      prismaService.goal.findFirst.mockResolvedValue(mockGoal as any);
      prismaService.goalContribution.findMany.mockResolvedValue([
        mockContribution,
        { ...mockContribution, id: 'contribution-2', transactionId: null },
      ] as any);

      // Act
      const result = await service.getContributions(mockGoalId, mockUserId);

      // Assert
      expect(prismaService.goal.findFirst).toHaveBeenCalledWith({
        where: { id: mockGoalId, userId: mockUserId },
      });
      expect(prismaService.goalContribution.findMany).toHaveBeenCalledWith({
        where: { goalId: mockGoalId },
        orderBy: { date: 'desc' },
      });
      expect(result).toEqual([
        {
          id: 'contribution-1',
          goalId: mockGoalId,
          transactionId: mockTransactionId,
          amount: 500,
          date: mockContribution.date,
        },
        {
          id: 'contribution-2',
          goalId: mockGoalId,
          transactionId: undefined,
          amount: 500,
          date: mockContribution.date,
        },
      ]);
    });

    it('should throw NotFoundError when goal not found', async () => {
      // Arrange
      prismaService.goal.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.getContributions('non-existent', mockUserId),
      ).rejects.toThrow(NotFoundError);
      expect(prismaService.goalContribution.findMany).not.toHaveBeenCalled();
    });
  });

  describe('mapGoal', () => {
    it('should correctly map goal with all fields', () => {
      // Act
      const result = service['mapGoal'](mockGoal as any);

      // Assert
      expect(result).toEqual({
        id: mockGoal.id,
        userId: mockGoal.userId,
        name: mockGoal.name,
        targetAmount: Number(mockGoal.targetAmount),
        currentAmount: Number(mockGoal.currentAmount),
        currency: mockGoal.currency,
        dueDate: mockGoal.dueDate,
        createdAt: mockGoal.createdAt,
      });
    });

    it('should map a null due date to undefined', () => {
      // Arrange
      const goalWithoutDueDate = { ...mockGoal, dueDate: null };

      // Act
      const result = service['mapGoal'](goalWithoutDueDate as any);

      // Assert
      expect(result.dueDate).toBeUndefined();
    });

    it('should not expose relations such as contributions', () => {
      // Arrange
      const goalWithContributions = {
        ...mockGoal,
        contributions: [mockContribution],
      };

      // Act
      const result = service['mapGoal'](goalWithContributions as any);

      // Assert
      expect(result).not.toHaveProperty('contributions');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle very large target amounts', async () => {
      // Arrange
      const largeTargetInput = {
        name: 'Mansion Fund',
        targetAmount: 999999999.99,
        currency: 'USD',
      };

      const largeGoal = {
        ...mockGoal,
        targetAmount: largeTargetInput.targetAmount,
      };
      prismaService.goal.create.mockResolvedValue(largeGoal as any);

      // Act
      const result = await service.create(mockUserId, largeTargetInput);

      // Assert
      expect(result.targetAmount).toBe(largeTargetInput.targetAmount);
    });

    it('should handle concurrent contribution additions', async () => {
      // Arrange
      prismaService.goal.findFirst.mockResolvedValue(mockGoal as any);
      prismaService.$transaction.mockRejectedValue(
        new Error('Concurrent modification'),
      );

      // Act & Assert
      await expect(
        service.addContribution(mockUserId, {
          goalId: mockGoalId,
          amount: 100.0,
          date: new Date(),
        }),
      ).rejects.toThrow('Concurrent modification');
    });

    it('should allow a contribution that pushes the goal past its target', async () => {
      // Arrange
      const nearCompletionGoal = { ...mockGoal, currentAmount: 9800.0 };
      prismaService.goal.findFirst.mockResolvedValue(nearCompletionGoal as any);

      const mockTx = mockTxWith();
      mockTx.goalContribution.create.mockResolvedValue({
        id: 'contribution-4',
        goalId: mockGoalId,
        transactionId: null,
        amount: 300.0,
        date: new Date('2024-02-01'),
      });
      prismaService.$transaction.mockImplementation(runTransactionWith(mockTx));

      // Act
      const result = await service.addContribution(mockUserId, {
        goalId: mockGoalId,
        amount: 300.0,
        date: new Date('2024-02-01'),
      });

      // Assert - the full amount is recorded; the goal is not capped at target
      expect(mockTx.goal.update).toHaveBeenCalledWith({
        where: { id: mockGoalId },
        data: { currentAmount: { increment: 300.0 } },
      });
      expect(result.amount).toBe(300);
    });
  });

  describe('getGoalProjection', () => {
    it('projects with the monthly amount given', async () => {
      prismaService.goal.findFirst.mockResolvedValue(mockGoal as any);

      const result = await service.getGoalProjection(
        mockGoalId,
        mockUserId,
        1000,
      );

      expect(prismaService.goalContribution.aggregate).not.toHaveBeenCalled();
      expect(result).toEqual({
        goalId: mockGoalId,
        monthlyContribution: 1000,
        monthsRemaining: 7,
        completionDate: expect.any(Date),
      });
    });

    it('defaults to the average of the last 3 months of contributions', async () => {
      prismaService.goal.findFirst.mockResolvedValue(mockGoal as any);
      prismaService.goalContribution.aggregate.mockResolvedValue({
        _sum: { amount: 2100 },
      } as any);

      const result = await service.getGoalProjection(mockGoalId, mockUserId);

      expect(prismaService.goalContribution.aggregate).toHaveBeenCalledWith({
        where: { goalId: mockGoalId, date: { gte: expect.any(Date) } },
        _sum: { amount: true },
      });
      expect(result.monthlyContribution).toBe(700);
      expect(result.monthsRemaining).toBe(10);
    });

    it('has no completion date without contributions', async () => {
      prismaService.goal.findFirst.mockResolvedValue(mockGoal as any);
      prismaService.goalContribution.aggregate.mockResolvedValue({
        _sum: { amount: null },
      } as any);

      const result = await service.getGoalProjection(mockGoalId, mockUserId);

      expect(result).toEqual({ goalId: mockGoalId, monthlyContribution: 0 });
    });

    it('is 0 months away for a reached goal', async () => {
      prismaService.goal.findFirst.mockResolvedValue({
        ...mockGoal,
        currentAmount: 10000,
      } as any);

      const result = await service.getGoalProjection(
        mockGoalId,
        mockUserId,
        100,
      );

      expect(result.monthsRemaining).toBe(0);
      expect(result.completionDate).toBeUndefined();
    });

    it("rejects another user's goal", async () => {
      prismaService.goal.findFirst.mockResolvedValue(null);

      await expect(
        service.getGoalProjection(mockGoalId, 'other-user', 100),
      ).rejects.toThrow(NotFoundError);
      expect(prismaService.goal.findFirst).toHaveBeenCalledWith({
        where: { id: mockGoalId, userId: 'other-user' },
      });
    });
  });

  describe('getGoalRecommendations', () => {
    it('covers all the goals of the user', async () => {
      prismaService.goal.findMany.mockResolvedValue([
        mockGoal,
        { ...mockGoal, id: 'goal-2', targetAmount: 2000, currentAmount: 2000 },
      ] as any);

      const result = await service.getGoalRecommendations(mockUserId);

      expect(prismaService.goal.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
      });
      expect(result.totalGoalsAmount).toBe(12000);
      expect(result.totalSavedAmount).toBe(5000);
      expect(result.averageProgress).toBe(65);
      expect(result.recommendedMonthlyContribution).toBeCloseTo(7000 / 12);
    });

    it('can be limited to one goal of the user', async () => {
      prismaService.goal.findMany.mockResolvedValue([mockGoal] as any);

      const result = await service.getGoalRecommendations(
        mockUserId,
        mockGoalId,
      );

      expect(prismaService.goal.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId, id: mockGoalId },
      });
      expect(result.totalGoalsAmount).toBe(10000);
    });

    it('fails for a goal the user does not own', async () => {
      prismaService.goal.findMany.mockResolvedValue([]);

      await expect(
        service.getGoalRecommendations(mockUserId, 'someone-elses'),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('contribution dates', () => {
    it('stores the local day of the contribution', async () => {
      prismaService.goal.findFirst.mockResolvedValue(mockGoal as any);
      const mockTx = mockTxWith();
      mockTx.goalContribution.create.mockResolvedValue(mockContribution);
      prismaService.$transaction.mockImplementation(runTransactionWith(mockTx));

      await service.addContribution(mockUserId, {
        goalId: mockGoalId,
        amount: 100,
        date: new Date('2026-10-14T04:30:00Z'),
      });

      expect(mockTx.goalContribution.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          date: new Date('2026-10-13T00:00:00Z'),
        }),
      });
    });
  });
});
