import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { BudgetsService } from './budgets.service';
import { PrismaService } from '../../services/prisma.service';
import { NotFoundError, ConflictError } from '../../common/exceptions/graphql-error.exception';

describe('BudgetsService', () => {
  let service: BudgetsService;
  let prismaService: DeepMockProxy<PrismaService>;

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
    prismaService = mockDeep<PrismaService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BudgetsService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    service = module.get<BudgetsService>(BudgetsService);

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
      const inputWithoutTotal: any = { ...createInput };
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
        include: { categories: true },
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

  describe('getCurrentBudget', () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date(2024, 0, 15));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return the budget for the current month and year', async () => {
      // Arrange
      prismaService.budget.findFirst.mockResolvedValue(mockBudget as any);

      // Act
      const result = await service.getCurrentBudget(mockUserId);

      // Assert
      expect(prismaService.budget.findFirst).toHaveBeenCalledWith({
        where: { userId: mockUserId, year: 2024, month: 1 },
        include: { categories: true },
      });
      expect(result?.year).toBe(2024);
      expect(result?.month).toBe(1);
    });

    it('should return null when no budget exists for the current month', async () => {
      // Arrange
      prismaService.budget.findFirst.mockResolvedValue(null);

      // Act
      const result = await service.getCurrentBudget(mockUserId);

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
      const mockTx = {
        bUDGET_CATEGORY: {
          deleteMany: jest.fn(),
          createMany: jest.fn(),
        },
        budget: {
          update: jest.fn().mockResolvedValue(updatedBudget),
          findUnique: jest.fn().mockResolvedValue(updatedBudget),
        },
      };
      prismaService.$transaction.mockImplementation(async (callback: any) =>
        callback(mockTx),
      );

      // Act
      const result = await service.update(mockBudgetId, mockUserId, updateInput);

      // Assert
      expect(mockTx.budget.update).toHaveBeenCalledWith({
        where: { id: mockBudgetId },
        data: { amountTotal: updateInput.amountTotal },
      });
      expect(mockTx.budget.findUnique).toHaveBeenCalledWith({
        where: { id: mockBudgetId },
        include: { categories: true },
      });
      expect(result.amountTotal).toBe(updateInput.amountTotal);
    });

    it('should not touch category caps when no categories are provided', async () => {
      // Arrange
      prismaService.budget.findFirst.mockResolvedValue(mockBudget as any);
      const mockTx = {
        bUDGET_CATEGORY: {
          deleteMany: jest.fn(),
          createMany: jest.fn(),
        },
        budget: {
          update: jest.fn().mockResolvedValue(mockBudget),
          findUnique: jest.fn().mockResolvedValue(mockBudget),
        },
      };
      prismaService.$transaction.mockImplementation(async (callback: any) =>
        callback(mockTx),
      );

      // Act
      await service.update(mockBudgetId, mockUserId, { amountTotal: 100 });

      // Assert
      expect(mockTx.bUDGET_CATEGORY.deleteMany).not.toHaveBeenCalled();
      expect(mockTx.bUDGET_CATEGORY.createMany).not.toHaveBeenCalled();
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
            findUnique: jest.fn().mockResolvedValue(mockBudget),
          },
        };
        return callback(mockTx as any);
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

  describe('getBudgetUsage', () => {
    it('should calculate usage per budgeted category', async () => {
      // Arrange
      prismaService.budget.findFirst.mockResolvedValue(mockBudget as any);
      (prismaService.transaction.aggregate as jest.Mock).mockResolvedValueOnce({
        _sum: { amount: 250.0 },
      });

      // Act
      const result = await service.getBudgetUsage(mockBudgetId, mockUserId);

      // Assert
      expect(prismaService.budget.findFirst).toHaveBeenCalledWith({
        where: { id: mockBudgetId, userId: mockUserId },
        include: { categories: true },
      });
      expect(prismaService.transaction.aggregate).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          categoryId: mockCategoryId,
          type: 'expense',
          txnDate: {
            gte: new Date(2024, 0, 1),
            lte: new Date(2024, 0, 31),
          },
        },
        _sum: { amount: true },
      });
      expect(result).toEqual([
        {
          categoryId: mockCategoryId,
          budgeted: 300,
          spent: 250,
          remaining: 50,
          percentage: 83.33,
        },
      ]);
    });

    it('should report negative remaining when over budget', async () => {
      // Arrange
      prismaService.budget.findFirst.mockResolvedValue(mockBudget as any);
      (prismaService.transaction.aggregate as jest.Mock).mockResolvedValueOnce({
        _sum: { amount: 400.0 },
      });

      // Act
      const [usage] = await service.getBudgetUsage(mockBudgetId, mockUserId);

      // Assert
      expect(usage.remaining).toBe(-100);
      expect(usage.percentage).toBe(133.33);
    });

    it('should treat a null aggregate sum as zero spent', async () => {
      // Arrange
      prismaService.budget.findFirst.mockResolvedValue(mockBudget as any);
      (prismaService.transaction.aggregate as jest.Mock).mockResolvedValueOnce({
        _sum: { amount: null },
      });

      // Act
      const [usage] = await service.getBudgetUsage(mockBudgetId, mockUserId);

      // Assert
      expect(usage.spent).toBe(0);
      expect(usage.remaining).toBe(300);
      expect(usage.percentage).toBe(0);
    });

    it('should throw NotFoundError when budget not found', async () => {
      // Arrange
      prismaService.budget.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.getBudgetUsage('non-existent', mockUserId),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('getBudgetSummary', () => {
    it('should summarize totals and category usage for the month', async () => {
      // Arrange
      prismaService.budget.findFirst.mockResolvedValue(mockBudget as any);
      (prismaService.transaction.aggregate as jest.Mock)
        .mockResolvedValueOnce({ _sum: { amount: 270.0 } }) // total expenses
        .mockResolvedValueOnce({ _sum: { amount: 250.0 } }); // category expenses

      // Act
      const result = await service.getBudgetSummary(mockUserId, 2024, 1);

      // Assert
      expect(result).toEqual({
        budgetId: mockBudgetId,
        year: 2024,
        month: 1,
        totalBudgeted: 300, // sum of category caps
        totalSpent: 270,
        totalRemaining: 30,
        overallPercentage: 90,
        categoryCount: 1,
        categoriesOverBudget: 0,
        categoriesNearBudget: 1, // 83.33%
        categoryUsage: [
          {
            categoryId: mockCategoryId,
            budgeted: 300,
            spent: 250,
            remaining: 50,
            percentage: 83.33,
          },
        ],
      });
    });

    it('should count categories over budget', async () => {
      // Arrange
      prismaService.budget.findFirst.mockResolvedValue(mockBudget as any);
      (prismaService.transaction.aggregate as jest.Mock)
        .mockResolvedValueOnce({ _sum: { amount: 500.0 } })
        .mockResolvedValueOnce({ _sum: { amount: 400.0 } });

      // Act
      const result = await service.getBudgetSummary(mockUserId, 2024, 1);

      // Assert
      expect(result.totalRemaining).toBe(-200);
      expect(result.overallPercentage).toBe(166.67);
      expect(result.categoriesOverBudget).toBe(1);
      expect(result.categoriesNearBudget).toBe(0);
    });

    it('should throw NotFoundError when no budget exists for the month', async () => {
      // Arrange
      prismaService.budget.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.getBudgetSummary(mockUserId, 2024, 12),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('getBudgetAlerts', () => {
    const budgetWithCategories = {
      ...mockBudget,
      categories: [
        {
          id: 'budget-category-1',
          budgetId: mockBudgetId,
          categoryId: 'cat-food',
          capAmount: 300.0,
          category: { id: 'cat-food', name: 'Food & Dining' },
        },
        {
          id: 'budget-category-2',
          budgetId: mockBudgetId,
          categoryId: 'cat-fun',
          capAmount: 100.0,
          category: { id: 'cat-fun', name: 'Entertainment' },
        },
        {
          id: 'budget-category-3',
          budgetId: mockBudgetId,
          categoryId: 'cat-rent',
          capAmount: 1000.0,
          category: { id: 'cat-rent', name: 'Rent' },
        },
      ],
    };

    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date(2024, 0, 15));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return alerts for categories at or above 80%, sorted by percentage', async () => {
      // Arrange
      prismaService.budget.findFirst.mockResolvedValue(budgetWithCategories as any);
      (prismaService.transaction.aggregate as jest.Mock)
        .mockResolvedValueOnce({ _sum: { amount: 280.0 } }) // food: 93.33%
        .mockResolvedValueOnce({ _sum: { amount: 120.0 } }) // fun: 120%
        .mockResolvedValueOnce({ _sum: { amount: 500.0 } }); // rent: 50%

      // Act
      const result = await service.getBudgetAlerts(mockUserId);

      // Assert
      expect(prismaService.budget.findFirst).toHaveBeenCalledWith({
        where: { userId: mockUserId, year: 2024, month: 1 },
        include: { categories: { include: { category: true } } },
      });
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        categoryId: 'cat-fun',
        categoryName: 'Entertainment',
        budgeted: 100,
        spent: 120,
        percentage: 120,
        severity: 'high',
        message: 'Budget exceeded by 20',
      });
      expect(result[1]).toEqual({
        categoryId: 'cat-food',
        categoryName: 'Food & Dining',
        budgeted: 300,
        spent: 280,
        percentage: 93.33,
        severity: 'medium',
        message: '6.67% of budget remaining',
      });
    });

    it('should use low severity between 80% and 90%', async () => {
      // Arrange
      prismaService.budget.findFirst.mockResolvedValue({
        ...budgetWithCategories,
        categories: [budgetWithCategories.categories[0]],
      } as any);
      (prismaService.transaction.aggregate as jest.Mock).mockResolvedValueOnce({
        _sum: { amount: 250.0 },
      });

      // Act
      const result = await service.getBudgetAlerts(mockUserId);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].severity).toBe('low');
    });

    it('should return empty array when no category reaches the threshold', async () => {
      // Arrange
      prismaService.budget.findFirst.mockResolvedValue(budgetWithCategories as any);
      (prismaService.transaction.aggregate as jest.Mock).mockResolvedValue({
        _sum: { amount: 10.0 },
      });

      // Act
      const result = await service.getBudgetAlerts(mockUserId);

      // Assert
      expect(result).toEqual([]);
    });

    it('should return empty array when no budget exists', async () => {
      // Arrange
      prismaService.budget.findFirst.mockResolvedValue(null);

      // Act
      const result = await service.getBudgetAlerts(mockUserId);

      // Assert
      expect(result).toEqual([]);
      expect(prismaService.transaction.aggregate).not.toHaveBeenCalled();
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
          budgetId: cat.budgetId,
          categoryId: cat.categoryId,
          capAmount: Number(cat.capAmount),
        })),
      });
    });

    it('should handle null amountTotal', () => {
      // Arrange
      const budgetWithNullTotal = { ...mockBudget, amountTotal: null };

      // Act
      const result = service['mapBudget'](budgetWithNullTotal as any);

      // Assert
      expect(result.amountTotal).toBeUndefined();
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
