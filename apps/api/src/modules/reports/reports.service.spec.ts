import { ReportsService, monthsOfData } from './reports.service';
import { PrismaService } from '../../services/prisma.service';

function prismaMock() {
  return {
    transaction: {
      aggregate: jest.fn(),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    category: { findMany: jest.fn().mockResolvedValue([]) },
    account: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
}

describe('ReportsService', () => {
  it('counts the whole month, last day included (UTC), without pending transactions', async () => {
    const prisma = prismaMock();
    prisma.transaction.aggregate
      .mockResolvedValueOnce({ _sum: { amount: 1000 } })
      .mockResolvedValueOnce({ _sum: { amount: 400 } });
    const service = new ReportsService(prisma as unknown as PrismaService);

    const report = await service.getMonthlyReport('user-1', 2026, 10);

    const txnDate = {
      gte: new Date('2026-10-01T00:00:00.000Z'),
      lt: new Date('2026-11-01T00:00:00.000Z'),
    };
    expect(prisma.transaction.aggregate).toHaveBeenCalledWith({
      where: { userId: 'user-1', isPending: false, txnDate, type: 'income' },
      _sum: { amount: true },
    });
    expect(prisma.transaction.aggregate).toHaveBeenCalledWith({
      where: { userId: 'user-1', isPending: false, txnDate, type: 'expense' },
      _sum: { amount: true },
    });
    expect(prisma.transaction.groupBy).toHaveBeenCalledWith({
      by: ['categoryId'],
      where: {
        userId: 'user-1',
        isPending: false,
        txnDate,
        type: 'expense',
        categoryId: { not: null },
      },
      _sum: { amount: true },
    });
    expect(report).toMatchObject({
      totalIncome: 1000,
      totalExpenses: 400,
      netIncome: 600,
      currency: 'MXN',
    });
  });

  it('projects with the monthly average of the months with data', async () => {
    const prisma = prismaMock();
    prisma.account.findMany.mockResolvedValue([
      { balanceCurrent: 5000 },
      { balanceCurrent: -1000 },
    ]);
    const twoMonthsAgo = new Date(Date.now() - 50 * 86_400_000);
    prisma.transaction.aggregate
      .mockResolvedValueOnce({ _sum: { amount: 20000 } })
      .mockResolvedValueOnce({ _sum: { amount: 12000 } })
      .mockResolvedValueOnce({ _min: { txnDate: twoMonthsAgo } });
    const service = new ReportsService(prisma as unknown as PrismaService);

    const projection = await service.getCashFlowProjection('user-1', 2);

    // 4,000 now; +10,000 income and -6,000 expenses a month.
    expect(projection.map((p) => p.projectedBalance)).toEqual([8000, 12000]);
    for (const [args] of prisma.transaction.aggregate.mock.calls as [
      { where: Record<string, unknown> },
    ][]) {
      expect(args.where).toMatchObject({ userId: 'user-1', isPending: false });
    }
  });

  it('names the category breakdown in the requested locale with one query', async () => {
    const prisma = prismaMock();
    prisma.transaction.aggregate
      .mockResolvedValueOnce({ _sum: { amount: 0 } })
      .mockResolvedValueOnce({ _sum: { amount: 400 } });
    prisma.transaction.groupBy.mockResolvedValue([
      { categoryId: 'cat-food', _sum: { amount: 300 } },
      { categoryId: 'cat-gone', _sum: { amount: 100 } },
    ]);
    prisma.category.findMany.mockResolvedValue([
      {
        id: 'cat-food',
        key: 'food',
        name: 'Food',
        translations: [{ name: 'Comida' }],
      },
    ]);
    const service = new ReportsService(prisma as unknown as PrismaService);

    const report = await service.getMonthlyReport('user-1', 2026, 10, 'es');

    expect(prisma.category.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['cat-food', 'cat-gone'] } },
      }),
    );
    expect(report.categoryBreakdown).toEqual([
      {
        categoryId: 'cat-food',
        categoryName: 'Comida',
        amount: 300,
        percentage: 75,
      },
      {
        categoryId: 'cat-gone',
        categoryName: 'Unknown',
        amount: 100,
        percentage: 25,
      },
    ]);
  });
});

describe('monthsOfData', () => {
  const now = new Date('2026-10-14T12:00:00Z');

  it('is between 1 and 6 months', () => {
    expect(monthsOfData(null, now)).toBe(1);
    expect(monthsOfData(new Date('2026-10-10T00:00:00Z'), now)).toBe(1);
    expect(monthsOfData(new Date('2026-08-20T00:00:00Z'), now)).toBe(2);
    expect(monthsOfData(new Date('2025-01-01T00:00:00Z'), now)).toBe(6);
  });
});
