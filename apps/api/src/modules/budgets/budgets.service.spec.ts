import { Test, TestingModule } from '@nestjs/testing';
import { BudgetsService } from './budgets.service';
import { PrismaService } from '../../services/prisma.service';
import { NotFoundError, ConflictError } from '../../common/exceptions/graphql-error.exception';

describe('BudgetsService', () => {
  let service: BudgetsService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockUserId = 'user-1';
  const mockBudgetId = 'budget-1';
  const mockCategoryId = 'category-1';

  const mockBudget = {
    id: mockBudgetId,
    userId: mockUserId,
    year: 2024,
    month: 1,
    currency: 'USD',
    amountTotal: 2000.00,
    createdAt: new Date('2024-01-01'),
    categories: [
      {
        id: 'budget-category-1',
        budgetId: mockBudgetId,
        categoryId: mockCategoryId,
        capAmount: 300.00,
        category: {
          id: mockCategoryId,
          name: 'Food & Dining',
        },
      },
    ],
  };

  beforeEach(async () => {
    const mockPrismaService = {
      budget: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      bUDGET_CATEGORY: {
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        upsert: jest.fn(),
      },
      transaction: {
        aggregate: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BudgetsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<BudgetsService>(BudgetsService);
    prismaService = module.get(PrismaService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    const createInput = {
      year: 2024,
      month: 1,
      currency: 'USD',
      amountTotal: 2000.00,
      categories: [
        {
          categoryId: mockCategoryId,
          capAmount: 300.00,
        },
      ],
    };

    it('should successfully create a new budget', async () => {
      // Arrange
      prismaService.budget.findFirst.mockResolvedValue(null);
      prismaService.budget.create.mockResolvedValue(mockBudget);

      // Act
      const result = await service.create(mockUserId, createInput);

      // Assert
      expect(prismaService.budget.findFirst).toHaveBeenCalledWith({
        where: { userId: mockUserId, year: createInput.year, month: createInput.month },
      });
      expect(prismaService.budget.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          year: createInput.year,
          month: createInput.month,
          currency: createInput.currency,
          amountTotal: createInput.amountTotal,
          categories: {
            create: createInput.categories.map((cat) => ({
              categoryId: cat.categoryId,
              capAmount: cat.capAmount,
            })),
          },
        },
        include: { categories: true },
      });
      expect(result).toEqual(expect.objectContaining({
        id: mockBudget.id,
        year: mockBudget.year,
        month: mockBudget.month,
        amountTotal: Number(mockBudget.amountTotal),
      }));
    });

    it('should throw ConflictError if budget already exists for the month', async () => {
      // Arrange
      prismaService.budget.findFirst.mockResolvedValue(mockBudget);

      // Act & Assert
      await expect(service.create(mockUserId, createInput)).rejects.toThrow(ConflictError);
      expect(prismaService.budget.create).not.toHaveBeenCalled();
    });

    it('should create budget with multiple category caps', async () => {
      // Arrange
      const multiCategoryInput = {
        ...createInput,
        categories: [
          { categoryId: 'cat-1', capAmount: 300.00 },
          { categoryId: 'cat-2', capAmount: 500.00 },
          { categoryId: 'cat-3', capAmount: 200.00 },
        ],
      };

      prismaService.budget.findFirst.mockResolvedValue(null);
      prismaService.budget.create.mockResolvedValue({
        ...mockBudget,
        categories: multiCategoryInput.categories.map((cat, index) => ({
          id: `budget-category-${index + 1}`,
          budgetId: mockBudgetId,
          categoryId: cat.categoryId,
          capAmount: cat.capAmount,
        })),
      } as any);

      // Act
      await service.create(mockUserId, multiCategoryInput);

      // Assert
      expect(prismaService.budget.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          categories: {
            create: multiCategoryInput.categories.map((cat) => ({
              categoryId: cat.categoryId,
              capAmount: cat.capAmount,
            })),
          },
        }),
        include: { categories: true },
      });
    });

    it('should create budget without total amount (null)', async () => {
      // Arrange
      const inputWithoutTotal = { ...createInput };
      delete inputWithoutTotal.amountTotal;

      prismaService.budget.findFirst.mockResolvedValue(null);
      prismaService.budget.create.mockResolvedValue({
        ...mockBudget,
        amountTotal: null,
      } as any);

      // Act
      await service.create(mockUserId, inputWithoutTotal);

      // Assert
      expect(prismaService.budget.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          amountTotal: undefined,
        }),
        include: { categories: true },
      });
    });
  });

  describe('findMany', () => {
    it('should return all budgets for user', async () => {
      // Arrange
      const mockBudgets = [mockBudget, { ...mockBudget, id: 'budget-2', month: 2 }];
      prismaService.budget.findMany.mockResolvedValue(mockBudgets as any);

      // Act
      const result = await service.findMany(mockUserId);

      // Assert
      expect(prismaService.budget.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        include: { categories: true },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
      });
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no budgets exist', async () => {
      // Arrange
      prismaService.budget.findMany.mockResolvedValue([]);

      // Act
      const result = await service.findMany(mockUserId);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should return budget when found', async () => {
      // Arrange
      prismaService.budget.findFirst.mockResolvedValue(mockBudget as any);

      // Act
      const result = await service.findById(mockBudgetId, mockUserId);

      // Assert
      expect(prismaService.budget.findFirst).toHaveBeenCalledWith({
        where: { id: mockBudgetId, userId: mockUserId },
        include: { categories: { include: { category: true } } },
      });
      expect(result.id).toBe(mockBudgetId);
    });

    it('should throw NotFoundError when budget not found', async () => {
      // Arrange
      prismaService.budget.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findById('non-existent', mockUserId)).rejects.toThrow(NotFoundError);
    });
  });

  describe('findByMonth', () => {
    it('should return budget for specific month and year', async () => {
      // Arrange
      prismaService.budget.findFirst.mockResolvedValue(mockBudget as any);

      // Act
      const result = await service.findByMonth(mockUserId, 2024, 1);

      // Assert
      expect(prismaService.budget.findFirst).toHaveBeenCalledWith({
        where: { userId: mockUserId, year: 2024, month: 1 },
        include: { categories: { include: { category: true } } },
      });
      expect(result?.year).toBe(2024);
      expect(result?.month).toBe(1);
    });

    it('should return null when budget not found for month', async () => {
      // Arrange
      prismaService.budget.findFirst.mockResolvedValue(null);

      // Act
      const result = await service.findByMonth(mockUserId, 2024, 12);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    const updateInput = {
      amountTotal: 2500.00,
      categories: [
        { categoryId: mockCategoryId, capAmount: 400.00 },
        { categoryId: 'new-category', capAmount: 250.00 },
      ],
    };

    it('should successfully update budget', async () => {
      // Arrange
      prismaService.budget.findFirst.mockResolvedValue(mockBudget as any);
      const updatedBudget = { ...mockBudget, amountTotal: updateInput.amountTotal };
      
      prismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          bUDGET_CATEGORY: { 
            deleteMany: jest.fn(),
            createMany: jest.fn(),
          },
          budget: { 
            update: jest.fn().mockResolvedValue(updatedBudget),
          },
        };
        return callback(mockTx);
      });

      // Act
      const result = await service.update(mockBudgetId, mockUserId, updateInput);

      // Assert
      expect(result.amountTotal).toBe(updateInput.amountTotal);
    });

    it('should throw NotFoundError when budget not found', async () => {
      // Arrange
      prismaService.budget.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.update('non-existent', mockUserId, updateInput)).rejects.toThrow(NotFoundError);
    });

    it('should handle category updates correctly', async () => {
      // Arrange
      prismaService.budget.findFirst.mockResolvedValue(mockBudget as any);
      
      let deletedCategories: any;
      let createdCategories: any;

      prismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          bUDGET_CATEGORY: { 
            deleteMany: jest.fn().mockImplementation((data) => {
              deletedCategories = data;
            }),
            createMany: jest.fn().mockImplementation((data) => {
              createdCategories = data;
            }),
          },
          budget: { 
            update: jest.fn().mockResolvedValue(mockBudget),
          },
        };
        return callback(mockTx);
      });

      // Act
      await service.update(mockBudgetId, mockUserId, updateInput);

      // Assert
      expect(deletedCategories).toEqual({
        where: { budgetId: mockBudgetId },
      });
      expect(createdCategories).toEqual({
        data: updateInput.categories.map((cat) => ({
          budgetId: mockBudgetId,
          categoryId: cat.categoryId,
          capAmount: cat.capAmount,
        })),
      });
    });
  });

  describe('delete', () => {
    it('should successfully delete budget', async () => {
      // Arrange
      prismaService.budget.findFirst.mockResolvedValue(mockBudget as any);
      prismaService.budget.delete.mockResolvedValue(mockBudget as any);

      // Act
      const result = await service.delete(mockBudgetId, mockUserId);

      // Assert
      expect(prismaService.budget.findFirst).toHaveBeenCalledWith({
        where: { id: mockBudgetId, userId: mockUserId },
      });
      expect(prismaService.budget.delete).toHaveBeenCalledWith({
        where: { id: mockBudgetId },
      });
      expect(result).toBe(true);
    });

    it('should throw NotFoundError when budget not found', async () => {
      // Arrange
      prismaService.budget.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.delete('non-existent', mockUserId)).rejects.toThrow(NotFoundError);
      expect(prismaService.budget.delete).not.toHaveBeenCalled();
    });
  });

  describe('calculateUsage', () => {
    it('should calculate budget usage for specific month', async () => {
      // Arrange
      prismaService.budget.findFirst.mockResolvedValue(mockBudget as any);
      
      // Mock transaction aggregations
      prismaService.transaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 1800.00 } }) // Total expenses
        .mockResolvedValueOnce({ _sum: { amount: 250.00 } }); // Category expenses

      // Act
      const result = await service.calculateUsage(mockUserId, 2024, 1);

      // Assert
      expect(result).toEqual(expect.objectContaining({
        budgetId: mockBudget.id,
        totalBudget: Number(mockBudget.amountTotal),
        totalSpent: 1800.00,
        remainingBudget: 200.00, // 2000 - 1800
        utilizationPercentage: 90.0, // 1800/2000 * 100
      }));
      expect(result.categories).toHaveLength(1);
      expect(result.categories[0]).toEqual(expect.objectContaining({
        categoryId: mockCategoryId,
        categoryName: 'Food & Dining',
        budgetAmount: 300.00,
        spentAmount: 250.00,
        remainingAmount: 50.00,
        utilizationPercentage: 83.33,
        isOverBudget: false,
      }));
    });

    it('should return null when no budget exists for month', async () => {
      // Arrange
      prismaService.budget.findFirst.mockResolvedValue(null);

      // Act
      const result = await service.calculateUsage(mockUserId, 2024, 12);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle over-budget scenarios', async () => {
      // Arrange
      prismaService.budget.findFirst.mockResolvedValue(mockBudget as any);
      
      // Mock over-budget spending
      prismaService.transaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 2500.00 } }) // Total over budget
        .mockResolvedValueOnce({ _sum: { amount: 400.00 } }); // Category over budget

      // Act
      const result = await service.calculateUsage(mockUserId, 2024, 1);

      // Assert
      expect(result!.totalSpent).toBe(2500.00);
      expect(result!.remainingBudget).toBe(-500.00); // Negative remaining
      expect(result!.utilizationPercentage).toBe(125.0); // Over 100%
      expect(result!.categories[0].isOverBudget).toBe(true);
    });

    it('should handle null total budget amount', async () => {
      // Arrange
      const budgetWithoutTotal = { ...mockBudget, amountTotal: null };
      prismaService.budget.findFirst.mockResolvedValue(budgetWithoutTotal as any);
      
      prismaService.transaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 1500.00 } })
        .mockResolvedValueOnce({ _sum: { amount: 250.00 } });

      // Act
      const result = await service.calculateUsage(mockUserId, 2024, 1);

      // Assert
      expect(result!.totalBudget).toBeNull();
      expect(result!.remainingBudget).toBeNull();
      expect(result!.utilizationPercentage).toBeNull();
    });
  });

  describe('getAlerts', () => {
    it('should return budget alerts for categories over threshold', async () => {
      // Arrange
      const budgetUsage = {
        budgetId: mockBudget.id,
        year: 2024,
        month: 1,
        totalBudget: 2000.00,
        totalSpent: 1800.00,
        remainingBudget: 200.00,
        utilizationPercentage: 90.0,
        categories: [
          {
            categoryId: mockCategoryId,
            categoryName: 'Food & Dining',
            budgetAmount: 300.00,
            spentAmount: 280.00,
            remainingAmount: 20.00,
            utilizationPercentage: 93.33,
            isOverBudget: false,
          },
        ],
      };

      jest.spyOn(service, 'calculateUsage').mockResolvedValue(budgetUsage);

      // Act
      const result = await service.getAlerts(mockUserId, 2024, 1, 85); // 85% threshold

      // Assert
      expect(result).toHaveLength(2); // Total budget and category alerts
      expect(result[0]).toEqual(expect.objectContaining({
        type: 'TOTAL_BUDGET_WARNING',
        severity: 'high',
        message: expect.stringContaining('90%'),
      }));
      expect(result[1]).toEqual(expect.objectContaining({
        type: 'CATEGORY_BUDGET_WARNING',
        severity: 'high',
        categoryId: mockCategoryId,
        categoryName: 'Food & Dining',
      }));
    });

    it('should return over-budget alerts', async () => {
      // Arrange
      const overBudgetUsage = {
        budgetId: mockBudget.id,
        year: 2024,
        month: 1,
        totalBudget: 2000.00,
        totalSpent: 2200.00,
        remainingBudget: -200.00,
        utilizationPercentage: 110.0,
        categories: [
          {
            categoryId: mockCategoryId,
            categoryName: 'Food & Dining',
            budgetAmount: 300.00,
            spentAmount: 350.00,
            remainingAmount: -50.00,
            utilizationPercentage: 116.67,
            isOverBudget: true,
          },
        ],
      };

      jest.spyOn(service, 'calculateUsage').mockResolvedValue(overBudgetUsage);

      // Act
      const result = await service.getAlerts(mockUserId, 2024, 1, 100);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('TOTAL_BUDGET_EXCEEDED');
      expect(result[0].severity).toBe('critical');
      expect(result[1].type).toBe('CATEGORY_BUDGET_EXCEEDED');
      expect(result[1].severity).toBe('critical');
    });

    it('should return empty array when no alerts', async () => {
      // Arrange
      const goodUsage = {
        budgetId: mockBudget.id,
        year: 2024,
        month: 1,
        totalBudget: 2000.00,
        totalSpent: 1000.00,
        remainingBudget: 1000.00,
        utilizationPercentage: 50.0,
        categories: [
          {
            categoryId: mockCategoryId,
            categoryName: 'Food & Dining',
            budgetAmount: 300.00,
            spentAmount: 150.00,
            remainingAmount: 150.00,
            utilizationPercentage: 50.0,
            isOverBudget: false,
          },
        ],
      };

      jest.spyOn(service, 'calculateUsage').mockResolvedValue(goodUsage);

      // Act
      const result = await service.getAlerts(mockUserId, 2024, 1, 80);

      // Assert
      expect(result).toHaveLength(0);
    });

    it('should return empty array when no budget exists', async () => {
      // Arrange
      jest.spyOn(service, 'calculateUsage').mockResolvedValue(null);

      // Act
      const result = await service.getAlerts(mockUserId, 2024, 12, 80);

      // Assert
      expect(result).toHaveLength(0);
    });
  });

  describe('mapBudget', () => {
    it('should correctly map budget with all fields', () => {
      // Act
      const result = service['mapBudget'](mockBudget as any);

      // Assert
      expect(result).toEqual({
        id: mockBudget.id,
        userId: mockBudget.userId,
        year: mockBudget.year,
        month: mockBudget.month,
        currency: mockBudget.currency,
        amountTotal: Number(mockBudget.amountTotal),
        createdAt: mockBudget.createdAt,
        categories: mockBudget.categories.map((cat) => ({
          id: cat.id,
          categoryId: cat.categoryId,
          capAmount: Number(cat.capAmount),
          category: cat.category,
        })),
      });
    });

    it('should handle null amountTotal', () => {
      // Arrange
      const budgetWithNullTotal = { ...mockBudget, amountTotal: null };

      // Act
      const result = service['mapBudget'](budgetWithNullTotal as any);

      // Assert
      expect(result.amountTotal).toBeNull();
    });

    it('should handle empty categories', () => {
      // Arrange
      const budgetWithoutCategories = { ...mockBudget, categories: [] };

      // Act
      const result = service['mapBudget'](budgetWithoutCategories as any);

      // Assert
      expect(result.categories).toEqual([]);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle database errors during creation', async () => {
      // Arrange
      prismaService.budget.findFirst.mockResolvedValue(null);
      prismaService.budget.create.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(service.create(mockUserId, {
        year: 2024,
        month: 1,
        currency: 'USD',
        categories: [],
      })).rejects.toThrow('Database error');
    });

    it('should handle transaction rollback on update failure', async () => {
      // Arrange
      prismaService.budget.findFirst.mockResolvedValue(mockBudget as any);
      prismaService.$transaction.mockRejectedValue(new Error('Transaction failed'));

      // Act & Assert
      await expect(service.update(mockBudgetId, mockUserId, {
        categories: [],
      })).rejects.toThrow('Transaction failed');
    });

    it('should handle very large budget amounts', async () => {
      // Arrange
      const largeBudgetInput = {
        year: 2024,
        month: 1,
        currency: 'USD',
        amountTotal: 999999999.99,
        categories: [],
      };

      prismaService.budget.findFirst.mockResolvedValue(null);
      const largeBudget = { ...mockBudget, amountTotal: 999999999.99 };
      prismaService.budget.create.mockResolvedValue(largeBudget as any);

      // Act
      const result = await service.create(mockUserId, largeBudgetInput);

      // Assert
      expect(result.amountTotal).toBe(999999999.99);
    });

    it('should handle concurrent budget creation for same month', async () => {
      // Arrange
      prismaService.budget.findFirst.mockResolvedValue(null);
      prismaService.budget.create.mockRejectedValue(new Error('Unique constraint violation'));

      // Act & Assert
      await expect(service.create(mockUserId, {
        year: 2024,
        month: 1,
        currency: 'USD',
        categories: [],
      })).rejects.toThrow('Unique constraint violation');
    });
  });
});