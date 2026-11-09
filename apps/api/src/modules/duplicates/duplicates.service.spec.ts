import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { TransactionSource, TransactionType } from '@finnit/database';

import { PrismaService } from '../../services/prisma.service';
import { DuplicatesService } from './duplicates.service';
import { DuplicateAction, MergeNameFrom } from './dto/duplicate.dto';

const userId = 'user-1';

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'bank',
  userId,
  accountId: 'mi-cuenta',
  type: TransactionType.income,
  amount: 800,
  balanceEffect: 800,
  isPending: false,
  createdAt: new Date('2026-11-08T10:00:00Z'),
  txnDate: new Date('2026-11-08T00:00:00Z'),
  source: TransactionSource.imported,
  originalType: null,
  categoryId: null,
  categorySource: null,
  notes: null,
  aliasName: null,
  isPrivate: false,
  merchantName: null,
  description: '71126 Enviada desde Revolut Pago Recibido',
  alias: null,
  transferFrom: null,
  transferTo: null,
  debtPayment: null,
  debtCharge: null,
  debtDisbursement: null,
  recurringPayment: null,
  bankDifferenceOf: null,
  _count: { importedMatches: 0 },
  ...overrides,
});

/** The user's case: the bank's +800 and a transfer recorded by hand. */
const bank = row();
const manualLeg = row({
  id: 'manual',
  type: TransactionType.transfer,
  source: TransactionSource.manual,
  txnDate: new Date('2026-11-07T00:00:00Z'),
  description: 'Café',
  transferTo: { id: 'tr-1' },
  notes: 'De Revolut',
});

describe('DuplicatesService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let service: DuplicatesService;
  const tx = () => ({
    transaction: {
      findMany: jest.fn().mockResolvedValue([bank, manualLeg]),
      update: jest.fn(),
      delete: jest.fn(),
    },
    transfer: { update: jest.fn() },
    debtPayment: { update: jest.fn(), updateMany: jest.fn() },
    recurringOccurrence: { update: jest.fn() },
    goalContribution: { updateMany: jest.fn() },
    attachment: { updateMany: jest.fn() },
    account: { update: jest.fn() },
    linkedAccount: { findFirst: jest.fn().mockResolvedValue(null) },
    importedTransaction: { updateMany: jest.fn() },
  });
  let mockTx: ReturnType<typeof tx>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    service = new DuplicatesService(prisma);
    mockTx = tx();
    prisma.$transaction.mockImplementation((callback: any) => callback(mockTx));
    prisma.transaction.findUniqueOrThrow.mockResolvedValue({
      ...bank,
      attachments: [],
    } as never);
  });

  it("keeps the bank's movement as the transfer side, with the user's name", async () => {
    await service.merge(userId, {
      transactionId: 'manual',
      duplicateId: 'bank',
      nameFrom: MergeNameFrom.drop,
    });

    // The transfer now points at the bank's movement…
    expect(mockTx.transfer.update).toHaveBeenCalledWith({
      where: { id: 'tr-1' },
      data: { toTxnId: 'bank', convertedAt: expect.any(Date) },
    });
    expect(mockTx.transaction.update).toHaveBeenCalledWith({
      where: { id: 'bank' },
      data: expect.objectContaining({
        type: TransactionType.transfer,
        originalType: TransactionType.income,
      }),
    });
    // …named as the user called it, with their notes.
    expect(mockTx.transaction.update).toHaveBeenCalledWith({
      where: { id: 'bank' },
      data: expect.objectContaining({
        aliasName: 'Café',
        notes: 'De Revolut',
      }),
    });
    // The hand-made copy goes, taking its +800 with it.
    expect(mockTx.account.update).toHaveBeenCalledWith({
      where: { id: 'mi-cuenta' },
      data: { balanceCurrent: { increment: -800 } },
    });
    expect(mockTx.transaction.delete).toHaveBeenCalledWith({
      where: { id: 'manual' },
    });
  });

  it("keeps the bank's text when asked, and takes the other's category", async () => {
    mockTx.transaction.findMany.mockResolvedValue([
      bank,
      row({
        id: 'manual',
        source: TransactionSource.manual,
        categoryId: 'cat-1',
        categorySource: 'manual',
      }),
    ]);

    await service.merge(userId, {
      transactionId: 'bank',
      duplicateId: 'manual',
      nameFrom: MergeNameFrom.keep,
    });

    const update = mockTx.transaction.update.mock.calls.at(-1)![0];
    expect(update.data).not.toHaveProperty('aliasName');
    expect(update.data).toMatchObject({ categoryId: 'cat-1' });
    expect(mockTx.transfer.update).not.toHaveBeenCalled();
  });

  it.each([
    [
      'both from the bank',
      [bank, row({ id: 'manual' })],
      'Both movements came from the bank',
    ],
    [
      'in different accounts',
      [
        bank,
        row({
          id: 'manual',
          source: TransactionSource.manual,
          accountId: 'other',
        }),
      ],
      'Only the same amount',
    ],
    [
      'going different ways',
      [
        bank,
        row({
          id: 'manual',
          source: TransactionSource.manual,
          balanceEffect: -800,
          type: TransactionType.expense,
        }),
      ],
      'Only the same amount',
    ],
    [
      'an adjustment',
      [
        bank,
        row({
          id: 'manual',
          source: TransactionSource.manual,
          type: TransactionType.adjustment,
        }),
      ],
      'cannot be merged',
    ],
  ])('refuses movements %s', async (_label, rows, message) => {
    mockTx.transaction.findMany.mockResolvedValue(rows);
    await expect(
      service.merge(userId, {
        transactionId: 'bank',
        duplicateId: 'manual',
        nameFrom: MergeNameFrom.keep,
      }),
    ).rejects.toThrow(message);
    expect(mockTx.transaction.delete).not.toHaveBeenCalled();
  });

  it('remembers a pair the user says is not a duplicate', async () => {
    prisma.duplicateSuggestion.findFirst.mockResolvedValue({
      id: 's1',
      keepTxnId: 'bank',
      dropTxnId: 'manual',
    } as never);

    await service.resolve(userId, {
      id: 's1',
      action: DuplicateAction.dismiss,
      nameFrom: MergeNameFrom.keep,
    });

    expect(prisma.duplicateSuggestion.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { status: 'dismissed', resolvedAt: expect.any(Date) },
    });
  });

  it('suggests a clear pair once: one candidate, one of them from the bank', async () => {
    prisma.transaction.findMany
      // The new bank movement…
      .mockResolvedValueOnce([bank] as never)
      // …has exactly one candidate.
      .mockResolvedValueOnce([{ ...manualLeg, attachments: [] }] as never);
    prisma.transaction.findUniqueOrThrow.mockResolvedValue(manualLeg as never);
    prisma.duplicateSuggestion.findFirst.mockResolvedValue(null);

    await expect(service.detect(userId, ['bank'])).resolves.toBe(1);
    expect(prisma.duplicateSuggestion.create).toHaveBeenCalledWith({
      data: { userId, keepTxnId: 'bank', dropTxnId: 'manual' },
    });
  });
});
