import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { TransfersService } from './transfers.service';
import { PrismaService } from '../../services/prisma.service';

/** Makes `$transaction(callback)` run the callback against `tx`. */
const runTransactionWith = (tx: unknown) =>
  ((callback: (client: unknown) => unknown) =>
    Promise.resolve(callback(tx))) as never;

describe('TransfersService', () => {
  let service: TransfersService;
  let prisma: DeepMockProxy<PrismaService>;

  const userId = 'user-1';
  const account = (id: string) => ({
    id,
    userId,
    type: 'debit',
    name: `Account ${id}`,
    currency: 'MXN',
    balanceCurrent: 1000,
  });
  const txn = (id: string, accountId: string, txnDate: Date) => ({
    id,
    userId,
    accountId,
    categoryId: null,
    type: 'transfer',
    amount: 100,
    currency: 'MXN',
    txnDate,
    description: null,
    merchantName: null,
    isPending: false,
    isRecurringInstance: false,
    source: 'manual',
    externalId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransfersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(TransfersService);
  });

  const createWith = async (txnDate?: Date) => {
    prisma.account.findFirst
      .mockResolvedValueOnce(account('from') as any)
      .mockResolvedValueOnce(account('to') as any);
    const mockTx = {
      transaction: {
        create: jest.fn(
          (args: { data: { accountId: string; txnDate: Date } }) =>
            Promise.resolve(
              txn(
                `txn-${args.data.accountId}`,
                args.data.accountId,
                args.data.txnDate,
              ),
            ),
        ),
      },
      transfer: {
        create: jest.fn().mockResolvedValue({ id: 'transfer-1' }),
        findUnique: jest.fn(),
      },
      account: { update: jest.fn() },
      transferSuggestion: { updateMany: jest.fn() },
    };
    mockTx.transfer.findUnique.mockImplementation(() => {
      const [from, to] = mockTx.transaction.create.mock.calls.map(
        ([args]) => args.data,
      );
      return Promise.resolve({
        id: 'transfer-1',
        fromTxnId: 'txn-from',
        toTxnId: 'txn-to',
        amount: 100,
        createdAt: new Date(),
        fromTxn: txn('txn-from', 'from', from.txnDate),
        toTxn: txn('txn-to', 'to', to.txnDate),
      });
    });
    prisma.$transaction.mockImplementation(runTransactionWith(mockTx));

    const transfer = await service.create(userId, {
      fromAccountId: 'from',
      toAccountId: 'to',
      amount: 100,
      txnDate,
    });
    const dates = mockTx.transaction.create.mock.calls.map(
      ([args]) => args.data.txnDate,
    );
    const descriptions = mockTx.transaction.create.mock.calls.map(
      ([args]) => (args.data as { description?: string }).description,
    );
    return { transfer, dates, descriptions };
  };

  it('keeps the same description on both sides, with no English side suffix', async () => {
    const { descriptions } = await createWith();
    expect(descriptions).toEqual([
      'Transfer to Account to',
      'Transfer to Account to',
    ]);
  });

  it('dates both sides with the Mexico City day of the given moment', async () => {
    // Oct 13, 22:30 in Mexico City.
    const { dates, transfer } = await createWith(
      new Date('2026-10-14T04:30:00Z'),
    );

    const oct13 = new Date('2026-10-13T00:00:00Z');
    expect(dates).toEqual([oct13, oct13]);
    expect(transfer.fromTxn.txnDate).toEqual(oct13);
  });

  it('keeps a date-only value on its day', async () => {
    const { dates } = await createWith(new Date('2026-10-13'));

    expect(dates[0]).toEqual(new Date('2026-10-13T00:00:00Z'));
  });

  it('defaults to today as a date-only value', async () => {
    const { dates } = await createWith();

    expect(dates[0].getTime() % 86_400_000).toBe(0);
  });

  describe('with a movement already recorded', () => {
    const recorded = {
      id: 'bank-in',
      accountId: 'to',
      type: 'income',
      amount: 100,
      balanceEffect: 100,
      txnDate: new Date('2026-11-08T00:00:00Z'),
    };
    const tx = () => ({
      transaction: {
        findFirst: jest.fn().mockResolvedValue(recorded),
        create: jest.fn().mockResolvedValue({ id: 'new-out' }),
        update: jest.fn(),
      },
      transfer: {
        create: jest.fn().mockResolvedValue({ id: 'transfer-1' }),
        findUnique: jest.fn().mockResolvedValue({
          id: 'transfer-1',
          fromTxnId: 'new-out',
          toTxnId: 'bank-in',
          amount: 100,
          createdAt: new Date(),
          fromTxn: txn('new-out', 'from', recorded.txnDate),
          toTxn: txn('bank-in', 'to', recorded.txnDate),
        }),
      },
      account: { update: jest.fn() },
      transferSuggestion: { updateMany: jest.fn() },
    });

    beforeEach(() => {
      prisma.account.findFirst
        .mockResolvedValueOnce(account('from') as any)
        .mockResolvedValueOnce(account('to') as any);
    });

    it('uses it as the incoming side: no new movement there, no money moves there', async () => {
      const mockTx = tx();
      prisma.$transaction.mockImplementation(runTransactionWith(mockTx));

      await service.create(userId, {
        fromAccountId: 'from',
        toAccountId: 'to',
        amount: 100,
        toTransactionId: 'bank-in',
      });

      // Only the outgoing side is created, on the recorded movement's day.
      expect(mockTx.transaction.create).toHaveBeenCalledTimes(1);
      expect(mockTx.transaction.create.mock.calls[0][0].data).toMatchObject({
        accountId: 'from',
        balanceEffect: -100,
        txnDate: recorded.txnDate,
      });
      expect(mockTx.account.update).toHaveBeenCalledTimes(1);
      expect(mockTx.account.update).toHaveBeenCalledWith({
        where: { id: 'from' },
        data: { balanceCurrent: { increment: -100 } },
      });
      // The recorded one becomes the side, keeping its effect.
      expect(mockTx.transaction.update).toHaveBeenCalledWith({
        where: { id: 'bank-in' },
        data: expect.objectContaining({
          type: 'transfer',
          originalType: 'income',
          balanceEffect: 100,
        }),
      });
      expect(mockTx.transfer.create.mock.calls[0][0].data).toMatchObject({
        fromTxnId: 'new-out',
        toTxnId: 'bank-in',
        convertedAt: expect.any(Date),
      });
    });

    it('refuses a movement going the wrong way', async () => {
      const mockTx = tx();
      mockTx.transaction.findFirst.mockResolvedValue({
        ...recorded,
        type: 'expense',
        balanceEffect: -100,
      });
      prisma.$transaction.mockImplementation(runTransactionWith(mockTx));

      await expect(
        service.create(userId, {
          fromAccountId: 'from',
          toAccountId: 'to',
          amount: 100,
          toTransactionId: 'bank-in',
        }),
      ).rejects.toThrow("doesn't match this side");
    });
  });
});
