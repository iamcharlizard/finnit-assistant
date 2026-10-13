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
    return { transfer, dates };
  };

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
});
