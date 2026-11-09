import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

import { PrismaService } from '../../services/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreditCardRemindersService } from './credit-card-reminders.service';
import {
  CreditCardsService,
  INTEREST_CATEGORY_KEY,
} from './credit-cards.service';

jest.mock('../../common/utils/local-date.util', () => ({
  localToday: () => new Date('2026-11-28T00:00:00Z'),
}));

const day = (d: string) => new Date(`${d}T00:00:00Z`);

describe('CreditCardsService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let service: CreditCardsService;

  const card = (extra: Record<string, unknown> = {}) => ({
    id: 'card-1',
    userId: 'user-1',
    name: 'Nu',
    type: 'credit',
    currency: 'MXN',
    balanceCurrent: -5000,
    bankDifferenceTransactionId: null,
    creditCardTerms: {
      statementDay: 7,
      paymentDueDay: 27,
      interestRateAnnual: 36,
    },
    linkedAccounts: [],
    ...extra,
  });

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    service = new CreditCardsService(prisma);
    prisma.statementImport.findMany.mockResolvedValue([]);
    prisma.recurringOccurrence.findMany.mockResolvedValue([]);
    prisma.debt.findMany.mockResolvedValue([]);
    prisma.category.findFirst.mockResolvedValue({ id: 'interest' } as never);
    // After the Nov 7 cut-off: a 1,000 charge and a 3,000 payment.
    prisma.transaction.findMany.mockResolvedValue([
      {
        id: 't1',
        type: 'expense',
        amount: 1000,
        balanceEffect: -1000,
        isPending: false,
        txnDate: day('2026-11-10'),
        categoryId: null,
      },
      {
        id: 't2',
        type: 'transfer',
        amount: 3000,
        balanceEffect: 3000,
        isPending: false,
        txnDate: day('2026-11-15'),
        categoryId: null,
      },
    ] as never);
  });

  it('computes the cycle whose payment is due now', async () => {
    prisma.account.findFirst.mockResolvedValue(card() as never);

    const period = await service.period('user-1', 'card-1');

    expect(period).toMatchObject({
      id: 'card-1:2026-11-07',
      statementDate: day('2026-11-07'),
      paymentDueDate: day('2026-11-27'),
      balanceAtStatement: 7000,
      noInterestPayment: 7000,
      paid: 3000,
      remaining: 4000,
      status: 'unpaid',
      connected: false,
      interestRecorded: false,
      interestCategoryId: 'interest',
    });
    // 4,000 × (36% / 360) × 10 days (to the Dec 7 cut-off) × 1.16
    expect(period?.interestEstimate).toBeCloseTo(46.4, 2);
    expect(prisma.category.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: INTEREST_CATEGORY_KEY, userId: null },
      }),
    );
  });

  it('asks no interest of cards that import from a bank', async () => {
    prisma.account.findFirst.mockResolvedValue(
      card({ linkedAccounts: [{ id: 'l1' }] }) as never,
    );
    const period = await service.period('user-1', 'card-1');
    expect(period).toMatchObject({ connected: true, interestEstimate: null });
  });

  it('is null without cut-off and payment days, and for other accounts', async () => {
    prisma.account.findFirst.mockResolvedValueOnce(
      card({ creditCardTerms: null }) as never,
    );
    expect(await service.period('user-1', 'card-1')).toBeNull();
    prisma.account.findFirst.mockResolvedValueOnce(
      card({ type: 'debit' }) as never,
    );
    expect(await service.period('user-1', 'card-1')).toBeNull();
    prisma.account.findFirst.mockResolvedValueOnce(null);
    await expect(service.period('user-1', 'card-1')).rejects.toThrow(
      'Account not found',
    );
  });

  it('lists cycles newest first with the cut-off as cursor', async () => {
    prisma.account.findFirst.mockResolvedValue(card() as never);
    const page = await service.periods('user-1', 'card-1', 2);
    expect(page.edges.map((e) => e.cursor)).toEqual([
      '2026-12-07',
      '2026-11-07',
    ]);
    expect(page.edges[0].node.status).toBe('open');
    expect(page.pageInfo.endCursor).toBe('2026-11-07');
  });

  it('notices interest recorded in the next cycle', async () => {
    prisma.account.findFirst.mockResolvedValue(card() as never);
    prisma.transaction.findMany.mockResolvedValue([
      {
        id: 't3',
        type: 'expense',
        amount: 46,
        balanceEffect: -46,
        isPending: false,
        txnDate: day('2026-11-28'),
        categoryId: 'interest',
      },
    ] as never);
    const period = await service.period('user-1', 'card-1', '2026-11-07');
    expect(period?.interestRecorded).toBe(true);
  });
});

describe('CreditCardRemindersService', () => {
  it('reminds once per card, cut-off and kind, in the user language', async () => {
    const prisma = mockDeep<PrismaService>();
    const cards = mockDeep<CreditCardsService>();
    const notifications = mockDeep<NotificationsService>();
    const service = new CreditCardRemindersService(
      prisma,
      cards,
      notifications,
    );
    cards.cardsWithTerms.mockResolvedValue([
      {
        id: 'card-1',
        userId: 'user-1',
        name: 'Nu',
        currency: 'MXN',
        balance: -5000,
        terms: { statementDay: 7, paymentDueDay: 27 },
        interestRateAnnual: 36,
        connected: false,
        bankDifferenceId: null,
      },
    ]);
    prisma.user.findMany.mockResolvedValue([
      { id: 'user-1', locale: 'es' },
    ] as never);
    cards.figures.mockResolvedValue([
      {
        id: 'card-1:2026-11-07',
        accountId: 'card-1',
        periodStart: day('2026-10-08'),
        statementDate: day('2026-11-07'),
        paymentDueDate: day('2026-11-27'),
        balanceAtStatement: 7000,
        pendingInstallments: 0,
        noInterestPayment: 7000,
        minimumPayment: null,
        paid: 3000,
        remaining: 4000,
        status: 'unpaid',
        fromStatement: false,
        connected: false,
        interestEstimate: 46.4,
        interestRecorded: false,
        interestCategoryId: 'interest',
        interestRateAnnual: 36,
        currency: 'MXN',
      },
    ] as never);
    notifications.notify.mockResolvedValue(true);

    expect(await service.remind('2026-11-28')).toBe(1);
    expect(notifications.notify).toHaveBeenCalledWith({
      userId: 'user-1',
      type: 'card_unpaid',
      title: 'Nu: no se cubrió el pago',
      message: expect.stringContaining('Registra los intereses'),
      relatedEntityType: 'credit_card_cycle',
      relatedEntityId: 'card-1:2026-11-07:unpaid',
    });

    notifications.notify.mockClear();
    expect(await service.remind('2026-11-20')).toBe(0);
    expect(notifications.notify).not.toHaveBeenCalled();
  });
});
