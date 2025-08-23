import { Test, TestingModule } from '@nestjs/testing';
import { GoalsService } from './goals.service';
import { PrismaService } from '../../services/prisma.service';
import { NotFoundError, ValidationError } from '../../common/exceptions/graphql-error.exception';

describe('GoalsService', () => {
  let service: GoalsService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockUserId = 'user-1';
  const mockGoalId = 'goal-1';
  const mockTransactionId = 'transaction-1';

  const mockGoal = {
    id: mockGoalId,
    userId: mockUserId,
    name: 'Emergency Fund',
    targetAmount: 10000.00,
    currentAmount: 3000.00,
    currency: 'USD',
    dueDate: new Date('2024-12-31'),
    createdAt: new Date('2024-01-01'),
    contributions: [
      {
        id: 'contribution-1',
        goalId: mockGoalId,
        transactionId: mockTransactionId,
        amount: 500.00,
        date: new Date('2024-01-15'),
      },
    ],
  };

  beforeEach(async () => {
    const mockPrismaService = {
      goal: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      goalContribution: {
        create: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
        aggregate: jest.fn(),
      },
      transaction: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoalsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<GoalsService>(GoalsService);
    prismaService = module.get(PrismaService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    const createInput = {
      name: 'Vacation Fund',
      targetAmount: 5000.00,
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
          currentAmount: 0,
        },
        include: { contributions: true },
      });
      expect(result).toEqual(expect.objectContaining({
        name: createInput.name,
        targetAmount: Number(createInput.targetAmount),
        currentAmount: 0,
      }));
    });

    it('should create goal without due date', async () => {
      // Arrange
      const inputWithoutDueDate = { ...createInput };
      delete inputWithoutDueDate.dueDate;
      
      const goalWithoutDueDate = { ...mockGoal, dueDate: null };
      prismaService.goal.create.mockResolvedValue(goalWithoutDueDate as any);

      // Act
      await service.create(mockUserId, inputWithoutDueDate);

      // Assert
      expect(prismaService.goal.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          dueDate: undefined,
        }),
        include: { contributions: true },
      });
    });

    it('should handle goal creation errors', async () => {
      // Arrange
      prismaService.goal.create.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(service.create(mockUserId, createInput)).rejects.toThrow('Database error');
    });
  });

  describe('findMany', () => {
    it('should return all goals for user', async () => {
      // Arrange
      const mockGoals = [mockGoal, { ...mockGoal, id: 'goal-2', name: 'Car Fund' }];
      prismaService.goal.findMany.mockResolvedValue(mockGoals as any);

      // Act
      const result = await service.findMany(mockUserId);

      // Assert
      expect(prismaService.goal.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        include: { contributions: true },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(2);
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
        include: { contributions: { include: { transaction: true } } },
      });
      expect(result.id).toBe(mockGoalId);
    });

    it('should throw NotFoundError when goal not found', async () => {
      // Arrange
      prismaService.goal.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findById('non-existent', mockUserId)).rejects.toThrow(NotFoundError);
    });
  });

  describe('update', () => {
    const updateInput = {
      name: 'Updated Goal Name',
      targetAmount: 15000.00,
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
        include: { contributions: true },
      });
      expect(result.name).toBe(updateInput.name);
      expect(result.targetAmount).toBe(Number(updateInput.targetAmount));
    });

    it('should throw NotFoundError when goal not found', async () => {
      // Arrange
      prismaService.goal.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.update('non-existent', mockUserId, updateInput)).rejects.toThrow(NotFoundError);
      expect(prismaService.goal.update).not.toHaveBeenCalled();
    });

    it('should validate target amount is positive', async () => {
      // Arrange
      const invalidInput = { ...updateInput, targetAmount: -1000.00 };
      prismaService.goal.findFirst.mockResolvedValue(mockGoal as any);

      // Act & Assert
      await expect(service.update(mockGoalId, mockUserId, invalidInput)).rejects.toThrow(ValidationError);
    });
  });

  describe('delete', () => {
    it('should successfully delete goal', async () => {
      // Arrange
      prismaService.goal.findFirst.mockResolvedValue(mockGoal as any);
      prismaService.goal.delete.mockResolvedValue(mockGoal as any);

      // Act
      const result = await service.delete(mockGoalId, mockUserId);

      // Assert
      expect(prismaService.goal.findFirst).toHaveBeenCalledWith({
        where: { id: mockGoalId, userId: mockUserId },
      });
      expect(prismaService.goal.delete).toHaveBeenCalledWith({
        where: { id: mockGoalId },
      });
      expect(result).toBe(true);
    });

    it('should throw NotFoundError when goal not found', async () => {
      // Arrange
      prismaService.goal.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.delete('non-existent', mockUserId)).rejects.toThrow(NotFoundError);
      expect(prismaService.goal.delete).not.toHaveBeenCalled();
    });
  });

  describe('addContribution', () => {
    const contributionInput = {
      goalId: mockGoalId,
      transactionId: mockTransactionId,
      amount: 200.00,
      date: new Date('2024-02-01'),
    };

    it('should successfully add contribution and update goal amount', async () => {
      // Arrange
      const mockTransaction = {
        id: mockTransactionId,
        userId: mockUserId,
        amount: 200.00,
        type: 'income',
      };

      prismaService.goal.findFirst.mockResolvedValue(mockGoal as any);
      prismaService.transaction.findFirst.mockResolvedValue(mockTransaction as any);

      const updatedGoal = { 
        ...mockGoal, 
        currentAmount: mockGoal.currentAmount + contributionInput.amount 
      };

      prismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          goalContribution: { 
            create: jest.fn().mockResolvedValue({
              id: 'contribution-2',
              ...contributionInput,
            }),
          },
          goal: { 
            update: jest.fn().mockResolvedValue(updatedGoal),
          },
        };
        return callback(mockTx);
      });

      // Act
      const result = await service.addContribution(mockUserId, contributionInput);

      // Assert
      expect(result.currentAmount).toBe(mockGoal.currentAmount + contributionInput.amount);
    });

    it('should throw NotFoundError when goal not found', async () => {
      // Arrange
      prismaService.goal.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.addContribution(mockUserId, contributionInput)).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when transaction not found', async () => {
      // Arrange
      prismaService.goal.findFirst.mockResolvedValue(mockGoal as any);
      prismaService.transaction.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.addContribution(mockUserId, contributionInput)).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError for negative contribution amount', async () => {
      // Arrange
      const negativeInput = { ...contributionInput, amount: -100.00 };
      prismaService.goal.findFirst.mockResolvedValue(mockGoal as any);

      // Act & Assert
      await expect(service.addContribution(mockUserId, negativeInput)).rejects.toThrow(ValidationError);
    });

    it('should handle contribution without transaction', async () => {
      // Arrange
      const manualContribution = { ...contributionInput };
      delete manualContribution.transactionId;

      prismaService.goal.findFirst.mockResolvedValue(mockGoal as any);

      const updatedGoal = { 
        ...mockGoal, 
        currentAmount: mockGoal.currentAmount + contributionInput.amount 
      };

      prismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          goalContribution: { 
            create: jest.fn().mockResolvedValue({
              id: 'contribution-3',
              ...manualContribution,
              transactionId: null,
            }),
          },
          goal: { 
            update: jest.fn().mockResolvedValue(updatedGoal),
          },
        };
        return callback(mockTx);
      });

      // Act
      await service.addContribution(mockUserId, manualContribution);

      // Assert - Should not validate transaction
      expect(prismaService.transaction.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('removeContribution', () => {
    const contributionId = 'contribution-1';

    it('should successfully remove contribution and update goal amount', async () => {
      // Arrange
      const mockContribution = {
        id: contributionId,
        goalId: mockGoalId,
        amount: 500.00,
        goal: { ...mockGoal },
      };

      prismaService.goalContribution.findFirst.mockResolvedValue(mockContribution as any);

      const updatedGoal = { 
        ...mockGoal, 
        currentAmount: mockGoal.currentAmount - mockContribution.amount 
      };

      prismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          goalContribution: { 
            delete: jest.fn(),
          },
          goal: { 
            update: jest.fn().mockResolvedValue(updatedGoal),
          },
        };
        return callback(mockTx);
      });

      // Act
      const result = await service.removeContribution(mockUserId, contributionId);

      // Assert
      expect(result.currentAmount).toBe(mockGoal.currentAmount - mockContribution.amount);
    });

    it('should throw NotFoundError when contribution not found', async () => {
      // Arrange
      prismaService.goalContribution.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.removeContribution(mockUserId, 'non-existent')).rejects.toThrow(NotFoundError);
    });

    it('should not allow negative current amount', async () => {
      // Arrange
      const largeContribution = {
        id: contributionId,
        goalId: mockGoalId,
        amount: mockGoal.currentAmount + 1000.00, // More than current amount
        goal: { ...mockGoal },
      };

      prismaService.goalContribution.findFirst.mockResolvedValue(largeContribution as any);

      // Act & Assert
      await expect(service.removeContribution(mockUserId, contributionId)).rejects.toThrow(ValidationError);
    });
  });

  describe('calculateProgress', () => {
    it('should calculate goal progress correctly', async () => {
      // Arrange
      prismaService.goal.findFirst.mockResolvedValue(mockGoal as any);

      // Act
      const result = await service.calculateProgress(mockGoalId, mockUserId);

      // Assert
      expect(result).toEqual({
        goalId: mockGoal.id,
        targetAmount: Number(mockGoal.targetAmount),
        currentAmount: Number(mockGoal.currentAmount),
        remainingAmount: Number(mockGoal.targetAmount) - Number(mockGoal.currentAmount),
        progressPercentage: (Number(mockGoal.currentAmount) / Number(mockGoal.targetAmount)) * 100,
        isCompleted: false,
        daysRemaining: expect.any(Number),
        projectedCompletionDate: expect.any(Date),
        monthlyTargetContribution: expect.any(Number),
      });
    });

    it('should handle completed goals', async () => {
      // Arrange
      const completedGoal = { 
        ...mockGoal, 
        currentAmount: mockGoal.targetAmount 
      };
      prismaService.goal.findFirst.mockResolvedValue(completedGoal as any);

      // Act
      const result = await service.calculateProgress(mockGoalId, mockUserId);

      // Assert
      expect(result.isCompleted).toBe(true);
      expect(result.progressPercentage).toBe(100);
      expect(result.remainingAmount).toBe(0);
    });

    it('should handle goals without due date', async () => {
      // Arrange
      const goalWithoutDueDate = { ...mockGoal, dueDate: null };
      prismaService.goal.findFirst.mockResolvedValue(goalWithoutDueDate as any);

      // Act
      const result = await service.calculateProgress(mockGoalId, mockUserId);

      // Assert
      expect(result.daysRemaining).toBeNull();
      expect(result.projectedCompletionDate).toBeNull();
      expect(result.monthlyTargetContribution).toBeNull();
    });

    it('should throw NotFoundError when goal not found', async () => {
      // Arrange
      prismaService.goal.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.calculateProgress('non-existent', mockUserId)).rejects.toThrow(NotFoundError);
    });
  });

  describe('getContributions', () => {
    it('should return goal contributions with pagination', async () => {
      // Arrange
      const mockContributions = [
        {
          id: 'contribution-1',
          goalId: mockGoalId,
          amount: 500.00,
          date: new Date('2024-01-15'),
          transactionId: mockTransactionId,
          transaction: {
            id: mockTransactionId,
            description: 'Salary deposit',
          },
        },
      ];

      prismaService.goal.findFirst.mockResolvedValue(mockGoal as any);
      prismaService.goalContribution.findMany.mockResolvedValue(mockContributions as any);

      // Act
      const result = await service.getContributions(mockGoalId, mockUserId, { limit: 10, offset: 0 });

      // Assert
      expect(prismaService.goalContribution.findMany).toHaveBeenCalledWith({
        where: { goalId: mockGoalId },
        include: { transaction: true },
        orderBy: { date: 'desc' },
        take: 10,
        skip: 0,
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(expect.objectContaining({
        id: 'contribution-1',
        amount: Number(mockContributions[0].amount),
      }));
    });

    it('should throw NotFoundError when goal not found', async () => {
      // Arrange
      prismaService.goal.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getContributions('non-existent', mockUserId)).rejects.toThrow(NotFoundError);
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
        contributions: mockGoal.contributions.map((contrib) => ({
          id: contrib.id,
          goalId: contrib.goalId,
          transactionId: contrib.transactionId,
          amount: Number(contrib.amount),
          date: contrib.date,
        })),
      });
    });

    it('should handle goal with null due date', () => {
      // Arrange
      const goalWithoutDueDate = { ...mockGoal, dueDate: null };

      // Act
      const result = service['mapGoal'](goalWithoutDueDate as any);

      // Assert
      expect(result.dueDate).toBeNull();
    });

    it('should handle goal without contributions', () => {
      // Arrange
      const goalWithoutContributions = { ...mockGoal, contributions: [] };

      // Act
      const result = service['mapGoal'](goalWithoutContributions as any);

      // Assert
      expect(result.contributions).toEqual([]);
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

      const largeGoal = { ...mockGoal, targetAmount: largeTargetInput.targetAmount };
      prismaService.goal.create.mockResolvedValue(largeGoal as any);

      // Act
      const result = await service.create(mockUserId, largeTargetInput);

      // Assert
      expect(result.targetAmount).toBe(largeTargetInput.targetAmount);
    });

    it('should handle concurrent contribution additions', async () => {
      // Arrange
      prismaService.goal.findFirst.mockResolvedValue(mockGoal as any);
      prismaService.transaction.findFirst.mockResolvedValue({ id: mockTransactionId } as any);
      prismaService.$transaction.mockRejectedValue(new Error('Concurrent modification'));

      // Act & Assert
      await expect(service.addContribution(mockUserId, {
        goalId: mockGoalId,
        amount: 100.00,
        date: new Date(),
      })).rejects.toThrow('Concurrent modification');
    });

    it('should validate contribution amount precision', async () => {
      // Arrange
      const precisionContribution = {
        goalId: mockGoalId,
        amount: 123.456789, // More than 2 decimal places
        date: new Date(),
      };

      prismaService.goal.findFirst.mockResolvedValue(mockGoal as any);

      // Act & Assert - Service should handle precision internally
      await expect(service.addContribution(mockUserId, precisionContribution)).rejects.toThrow(ValidationError);
    });

    it('should handle goal completion scenarios correctly', async () => {
      // Arrange
      const nearCompletionGoal = { ...mockGoal, currentAmount: 9800.00 };
      const completingContribution = {
        goalId: mockGoalId,
        amount: 300.00, // This would exceed the target
        date: new Date(),
      };

      prismaService.goal.findFirst.mockResolvedValue(nearCompletionGoal as any);

      const completedGoal = { 
        ...nearCompletionGoal, 
        currentAmount: nearCompletionGoal.targetAmount // Cap at target
      };

      prismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          goalContribution: { create: jest.fn() },
          goal: { update: jest.fn().mockResolvedValue(completedGoal) },
        };
        return callback(mockTx);
      });

      // Act
      const result = await service.addContribution(mockUserId, completingContribution);

      // Assert
      expect(result.currentAmount).toBe(nearCompletionGoal.targetAmount);
    });
  });
});