import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import {
  AccountType,
  AiFeatureKey,
  OccurrenceMatchSource,
  OccurrenceStatus,
  Prisma,
  RecurringExpenseKind,
  RecurringFrequency,
  RecurringTrackingMode,
  TransactionSource,
} from '@finnit/database';
import { PrismaService } from '../../../services/prisma.service';
import {
  AiModelsService,
  NoUsableAiModelError,
} from '../../ai/ai-models.service';
import { RecurringExpensesService } from '../recurring-expenses.service';
import {
  NotFoundError,
  ValidationError,
} from '../../../common/exceptions/graphql-error.exception';
import { suggestionFingerprint } from './detect';
import { RecurringSuggestionsService } from './recurring-suggestions.service';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const userId = 'user-1';
const fingerprint = suggestionFingerprint(userId, 'NETFLIXCOM', 'MXN');

const txnRow = (id: string, date: string, amount = 299) => ({
  id,
  txnDate: d(date),
  amount: new Prisma.Decimal(amount),
  currency: 'MXN',
  accountId: 'card-1',
  categoryId: 'cat-misc',
  merchantName: 'NETFLIX.COM',
  description: null,
  source: TransactionSource.imported,
});

const netflix = [
  txnRow('t1', '2026-07-10'),
  txnRow('t2', '2026-08-10'),
  txnRow('t3', '2026-09-10'),
  txnRow('t4', '2026-10-10'),
];

const categoryRow = (
  id: string,
  name: string,
  es: string,
  parentId = null,
) => ({
  id,
  userId,
  parentId,
  name,
  key: null,
  isDefault: false,
  sortOrder: null,
  createdAt: d('2026-01-01'),
  translations: [
    { locale: 'es', name: es },
    { locale: 'en', name },
  ],
});

const accountRow = {
  id: 'card-1',
  userId,
  type: AccountType.credit,
  name: 'Banamex Oro',
  currency: 'MXN',
  balanceCurrent: new Prisma.Decimal(-1200),
  metadata: null,
  archived: false,
  createdAt: d('2026-01-01'),
  updatedAt: d('2026-01-01'),
};

const stateRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'state-1',
  userId,
  fingerprint,
  dismissedAt: null,
  acceptedAt: null,
  aiName: null,
  aiKind: null,
  aiCategoryId: null,
  aiModel: null,
  classifiedAt: null,
  createdAt: d('2026-10-01'),
  updatedAt: d('2026-10-01'),
  ...overrides,
});

describe('RecurringSuggestionsService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let aiModels: DeepMockProxy<AiModelsService>;
  let service: RecurringSuggestionsService;

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-10-13T15:00:00.000Z') });
    prisma = mockDeep<PrismaService>();
    prisma.$transaction.mockImplementation((arg: unknown) =>
      Array.isArray(arg)
        ? (Promise.all(arg) as never)
        : ((arg as (tx: unknown) => unknown)(prisma) as never),
    );
    aiModels = mockDeep<AiModelsService>();
    service = new RecurringSuggestionsService(
      prisma,
      aiModels,
      new RecurringExpensesService(prisma),
    );

    prisma.transaction.findMany.mockResolvedValue(netflix as never);
    prisma.recurringExpense.findMany.mockResolvedValue([]);
    prisma.recurringSuggestionState.findMany.mockResolvedValue([]);
    prisma.category.findMany.mockImplementation(((args: {
      where: { id?: unknown };
    }) =>
      Promise.resolve(
        args.where.id
          ? [categoryRow('cat-streaming', 'Streaming', 'Streaming')]
          : [
              categoryRow('cat-misc', 'Misc', 'Varios'),
              categoryRow('cat-streaming', 'Streaming', 'Streaming'),
            ],
      )) as never);
    prisma.account.findMany.mockResolvedValue([accountRow] as never);
    prisma.recurringSuggestionState.upsert.mockImplementation(((args: {
      create: Record<string, unknown>;
    }) => Promise.resolve(stateRow(args.create))) as never);
  });

  afterEach(() => jest.useRealTimers());

  const aiAnswer = (payments: unknown[]) =>
    aiModels.extractFromText.mockResolvedValue({
      model: { modelId: 'claude-haiku-5-5' },
      data: { payments },
    } as never);

  describe('list', () => {
    it('classifies new suggestions with one AI call and stores the answer', async () => {
      aiAnswer([
        { ref: 's1', name: 'Netflix', kind: 'subscription', categoryId: 'c2' },
      ]);

      const [suggestion] = await service.list(userId);

      expect(aiModels.extractFromText).toHaveBeenCalledTimes(1);
      const [request, options] = aiModels.extractFromText.mock.calls[0];
      expect(options).toEqual({
        feature: AiFeatureKey.recurring_classification,
      });
      const sent = JSON.parse(request.text) as {
        payments: Record<string, unknown>[];
        categories: { id: string; name: string }[];
      };
      expect(sent.payments).toEqual([
        {
          ref: 's1',
          merchant: 'NETFLIX COM',
          amount: 299,
          currency: 'MXN',
          frequency: 'monthly',
          variableAmount: false,
          timesSeen: 4,
        },
      ]);
      expect(sent.categories).toEqual([
        { id: 'c1', name: 'Varios' },
        { id: 'c2', name: 'Streaming' },
      ]);
      // Only merchant, amounts and cadence leave the server.
      expect(request.text).not.toContain('card-1');
      expect(request.text).not.toContain('Banamex');

      expect(prisma.recurringSuggestionState.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            userId,
            fingerprint,
            aiName: 'Netflix',
            aiKind: RecurringExpenseKind.subscription,
            aiCategoryId: 'cat-streaming',
            aiModel: 'claude-haiku-5-5',
          }),
        }),
      );
      expect(suggestion).toMatchObject({
        fingerprint,
        merchant: 'NETFLIX COM',
        suggestedName: 'Netflix',
        kind: RecurringExpenseKind.subscription,
        frequency: RecurringFrequency.monthly,
        amount: 299,
        nextDueDate: d('2026-11-10'),
        classifiedBy: 'ai',
        category: { id: 'cat-streaming' },
        account: { id: 'card-1', balanceCurrent: -1200 },
      });
      expect(suggestion.occurrences[0]).toEqual({
        transactionId: 't4',
        date: d('2026-10-10'),
        amount: 299,
      });
    });

    it('uses the cached classification without calling the AI', async () => {
      prisma.recurringSuggestionState.findMany.mockResolvedValue([
        stateRow({
          aiName: 'Netflix',
          aiKind: RecurringExpenseKind.subscription,
          aiCategoryId: 'cat-streaming',
          classifiedAt: d('2026-10-12'),
        }),
      ] as never);

      const [suggestion] = await service.list(userId);

      expect(aiModels.extractFromText).not.toHaveBeenCalled();
      expect(suggestion).toMatchObject({
        suggestedName: 'Netflix',
        classifiedBy: 'ai',
      });
    });

    it('hides dismissed and accepted suggestions', async () => {
      prisma.recurringSuggestionState.findMany.mockResolvedValue([
        stateRow({ dismissedAt: d('2026-10-12') }),
      ] as never);
      expect(await service.list(userId)).toEqual([]);

      prisma.recurringSuggestionState.findMany.mockResolvedValue([
        stateRow({ acceptedAt: d('2026-10-12') }),
      ] as never);
      expect(await service.list(userId)).toEqual([]);
      expect(aiModels.extractFromText).not.toHaveBeenCalled();
    });

    it('ignores invalid AI output', async () => {
      aiAnswer([
        // Unknown category, invalid kind: only the name is kept.
        { ref: 's1', name: '  Netflix  ', kind: 'streaming', categoryId: 'x' },
        { ref: 's9', name: 'Ghost', kind: 'other' },
        'garbage',
      ]);

      const [suggestion] = await service.list(userId);

      expect(prisma.recurringSuggestionState.upsert).toHaveBeenCalledTimes(1);
      expect(prisma.recurringSuggestionState.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            aiName: 'Netflix',
            aiKind: null,
            aiCategoryId: null,
          }),
        }),
      );
      // Rules fill what the AI didn't: kind and the most common category.
      expect(suggestion).toMatchObject({
        suggestedName: 'Netflix',
        kind: RecurringExpenseKind.subscription,
      });
      expect(prisma.category.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({ where: { id: { in: ['cat-misc'] } } }),
      );
    });

    it('falls back to the rules when the AI fails, without storing anything', async () => {
      aiModels.extractFromText.mockRejectedValue(
        new NoUsableAiModelError('no model'),
      );

      const [suggestion] = await service.list(userId);

      expect(prisma.recurringSuggestionState.upsert).not.toHaveBeenCalled();
      expect(suggestion).toMatchObject({
        suggestedName: 'Netflix Com',
        kind: RecurringExpenseKind.subscription,
        classifiedBy: null,
      });
    });

    it('sends at most 30 suggestions per AI call', async () => {
      prisma.transaction.findMany.mockResolvedValue(
        Array.from({ length: 35 }, (_, m) =>
          netflix.map((row) => ({
            ...row,
            id: `${row.id}-${m}`,
            merchantName: `SERVICE ${String.fromCharCode(65 + (m % 26))}${String.fromCharCode(65 + Math.floor(m / 26))}X`,
          })),
        ).flat() as never,
      );
      aiAnswer([]);

      const suggestions = await service.list(userId);

      expect(suggestions).toHaveLength(35);
      expect(aiModels.extractFromText).toHaveBeenCalledTimes(1);
      const sent = JSON.parse(
        aiModels.extractFromText.mock.calls[0][0].text,
      ) as { payments: unknown[] };
      expect(sent.payments).toHaveLength(30);
    });

    it('does not call the AI when nothing is detected', async () => {
      prisma.transaction.findMany.mockResolvedValue([netflix[0]] as never);
      expect(await service.list(userId)).toEqual([]);
      expect(aiModels.extractFromText).not.toHaveBeenCalled();
    });

    it('filters by account and skips linked or pending movements in the query', async () => {
      aiAnswer([]);
      await service.list(userId, 'card-1');
      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            accountId: 'card-1',
            type: 'expense',
            isPending: false,
            recurringPayment: { is: null },
          }),
        }),
      );
    });
  });

  describe('accept', () => {
    const expenseRow = {
      id: 'rec-1',
      userId,
      name: 'Netflix',
      kind: RecurringExpenseKind.subscription,
      trackingMode: RecurringTrackingMode.automatic,
      frequency: RecurringFrequency.monthly,
      interval: 1,
      startDate: d('2026-07-10'),
      endDate: null,
      amount: new Prisma.Decimal(299),
      isVariableAmount: false,
      currency: 'MXN',
      accountId: 'card-1',
      categoryId: 'cat-streaming',
      debtId: null,
      merchantPattern: 'NETFLIX COM',
      installmentsTotal: null,
      installmentsPaid: 0,
      active: true,
      notes: null,
      nextDueDate: d('2026-11-10'),
      createdAt: d('2026-10-13'),
      updatedAt: d('2026-10-13'),
    };

    beforeEach(() => {
      prisma.recurringSuggestionState.findUnique.mockResolvedValue(
        stateRow({
          aiName: 'Netflix',
          aiKind: RecurringExpenseKind.subscription,
          aiCategoryId: 'cat-streaming',
          classifiedAt: d('2026-10-12'),
        }),
      );
      prisma.account.findFirst.mockResolvedValue({
        id: 'card-1',
        type: AccountType.credit,
      } as never);
      prisma.category.findFirst.mockResolvedValue({
        id: 'cat-streaming',
      } as never);
      prisma.recurringExpense.create.mockResolvedValue(expenseRow);
      prisma.recurringOccurrence.createMany.mockResolvedValue({ count: 4 });
    });

    it('creates the expense and links the past movements as paid', async () => {
      const result = await service.accept(userId, fingerprint);

      expect(prisma.recurringExpense.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          name: 'Netflix',
          kind: RecurringExpenseKind.subscription,
          trackingMode: RecurringTrackingMode.automatic,
          frequency: RecurringFrequency.monthly,
          interval: 1,
          startDate: d('2026-07-10'),
          amount: 299,
          isVariableAmount: false,
          currency: 'MXN',
          accountId: 'card-1',
          categoryId: 'cat-streaming',
          merchantPattern: 'NETFLIX COM',
        }),
      });
      const [history, schedule] =
        prisma.recurringOccurrence.createMany.mock.calls;
      expect(history[0]).toEqual({
        data: ['t1', 't2', 't3', 't4'].map((transactionId, i) => ({
          recurringExpenseId: 'rec-1',
          dueDate: d(`2026-${['07', '08', '09', '10'][i]}-10`),
          expectedAmount: 299,
          status: OccurrenceStatus.paid,
          paidAt: expect.any(Date),
          matchedBy: OccurrenceMatchSource.bank,
          transactionId,
        })),
      });
      // Scheduled occurrences start after the last paid charge.
      expect(schedule[0]).toEqual({
        data: [
          expect.objectContaining({ dueDate: d('2026-11-10') }),
          expect.objectContaining({ dueDate: d('2026-12-10') }),
        ],
        skipDuplicates: true,
      });
      expect(prisma.recurringSuggestionState.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_fingerprint: { userId, fingerprint } },
          update: { acceptedAt: expect.any(Date) },
        }),
      );
      expect(result).toMatchObject({ id: 'rec-1', name: 'Netflix' });
    });

    it('applies the overrides', async () => {
      prisma.account.findFirst.mockResolvedValue({
        id: 'cash-1',
        type: AccountType.cash,
      } as never);

      await service.accept(userId, fingerprint, {
        name: 'Netflix familiar',
        amount: 349,
        accountId: 'cash-1',
        categoryId: 'cat-misc',
        startDate: d('2026-08-10'),
      });

      expect(prisma.recurringExpense.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Netflix familiar',
          amount: 349,
          accountId: 'cash-1',
          categoryId: 'cat-misc',
          startDate: d('2026-08-10'),
          // Not a card: the user confirms each payment.
          trackingMode: RecurringTrackingMode.manual,
        }),
      });
    });

    it('fails when the suggestion no longer exists', async () => {
      await expect(
        service.accept(userId, suggestionFingerprint(userId, 'X', 'MXN')),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(prisma.recurringExpense.create).not.toHaveBeenCalled();
    });

    it('rejects a malformed fingerprint', async () => {
      await expect(service.accept(userId, 'a b')).rejects.toBeInstanceOf(
        ValidationError,
      );
    });
  });

  describe('dismiss', () => {
    it('stores the dismissal', async () => {
      await expect(service.dismiss(userId, fingerprint)).resolves.toBe(true);
      expect(prisma.recurringSuggestionState.upsert).toHaveBeenCalledWith({
        where: { userId_fingerprint: { userId, fingerprint } },
        create: { userId, fingerprint, dismissedAt: expect.any(Date) },
        update: { dismissedAt: expect.any(Date) },
      });
    });
  });
});
