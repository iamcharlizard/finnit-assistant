import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import {
  BankConnectionStatus,
  BankProvider,
  ImportedLineKind,
  ImportedLineStatus,
  OccurrenceMatchSource,
  Prisma,
  TransactionSource,
} from '@finnit/database';
import { PrismaService } from '../../services/prisma.service';
import { ReconciliationService } from '../statements/reconciliation/reconciliation.service';
import { LineMaterializerService } from '../statements/reconciliation/line-materializer.service';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../common/exceptions/graphql-error.exception';
import { BankConnectionsService } from './bank-connections.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  SyncfyClient,
  SyncfyCredential,
  SyncfyError,
} from './syncfy/syncfy.client';

const userId = 'user-1';

const connectionRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'conn-1',
  userId,
  provider: BankProvider.syncfy,
  providerItemId: 'cred-1',
  providerUserId: 'sy-user-1',
  institution: 'BancaNet Personal',
  status: BankConnectionStatus.active,
  lastStatusCode: 200,
  lastSyncedAt: null,
  lastPullRequestedAt: null,
  transactionsCursor: new Date('2026-10-10T00:00:00Z'),
  errorMessage: null,
  createdAt: new Date('2026-10-01'),
  updatedAt: new Date('2026-10-01'),
  ...overrides,
});

const credential = (
  overrides: Partial<SyncfyCredential> = {},
): SyncfyCredential => ({
  id_credential: 'cred-1',
  id_user: 'sy-user-1',
  id_site: 'site-1',
  is_authorized: 1,
  is_locked: 0,
  is_twofa: 0,
  can_sync: 1,
  ready_in: 0,
  code: 200,
  ...overrides,
});

const linkedRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'linked-card',
  bankConnectionId: 'conn-1',
  accountId: 'card-1',
  providerAccountId: 'sy-acc-card',
  mask: '1037',
  officialName: 'Tarjeta',
  type: 'Credit Card',
  currency: 'MXN',
  balance: null,
  creditLimit: null,
  availableCredit: null,
  balanceUpdatedAt: null,
  reconciledBalance: null,
  reconciledAt: null,
  ...overrides,
});

describe('BankConnectionsService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let syncfy: DeepMockProxy<SyncfyClient>;
  let reconciliation: DeepMockProxy<ReconciliationService>;
  let materializer: DeepMockProxy<LineMaterializerService>;
  let notifications: DeepMockProxy<NotificationsService>;
  let service: BankConnectionsService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    syncfy = mockDeep<SyncfyClient>();
    reconciliation = mockDeep<ReconciliationService>();
    materializer = mockDeep<LineMaterializerService>();
    Object.defineProperty(syncfy, 'isConfigured', { get: () => true });
    prisma.$transaction.mockImplementation(
      (fn: unknown) => (fn as (tx: unknown) => unknown)(prisma) as never,
    );
    syncfy.createSession.mockResolvedValue('session-token');
    materializer.materialize.mockResolvedValue({
      created: 0,
      balanceChange: 0,
      settledChange: 0,
    });
    notifications = mockDeep<NotificationsService>();
    service = new BankConnectionsService(
      prisma,
      syncfy,
      reconciliation,
      materializer,
      notifications,
    );
  });

  /** Default happy-path mocks for sync(). */
  const arrangeSync = (
    opts: {
      connection?: Record<string, unknown>;
      credential?: Partial<SyncfyCredential>;
    } = {},
  ) => {
    prisma.bankConnection.findFirst.mockResolvedValue(
      connectionRow(opts.connection),
    );
    prisma.bankConnection.findUniqueOrThrow.mockResolvedValue({
      ...connectionRow(opts.connection),
      linkedAccounts: [],
    } as never);
    syncfy.listCredentials.mockResolvedValue([credential(opts.credential)]);
    syncfy.listAccounts.mockResolvedValue([]);
    prisma.linkedAccount.findMany.mockResolvedValue([]);
  };

  describe('connectSession', () => {
    it('creates a Syncfy user tagged only with the Finnit user id', async () => {
      prisma.bankProviderUser.findUnique.mockResolvedValue(null);
      syncfy.listUsers.mockResolvedValue([]);
      syncfy.createUser.mockResolvedValue({ id_user: 'sy-new' });

      const session = await service.connectSession(userId);

      expect(syncfy.createUser).toHaveBeenCalledWith(userId, 'finnit-user-1');
      expect(prisma.bankProviderUser.create).toHaveBeenCalledWith({
        data: {
          userId,
          provider: BankProvider.syncfy,
          providerUserId: 'sy-new',
        },
      });
      expect(syncfy.createSession).toHaveBeenCalledWith('sy-new');
      expect(session.token).toBe('session-token');
    });

    it('reuses the mapped Syncfy user', async () => {
      prisma.bankProviderUser.findUnique.mockResolvedValue({
        providerUserId: 'sy-user-1',
      } as never);
      await service.connectSession(userId);
      expect(syncfy.listUsers).not.toHaveBeenCalled();
      expect(syncfy.createSession).toHaveBeenCalledWith('sy-user-1');
    });
  });

  describe('register', () => {
    it("rejects a credential that isn't the user's", async () => {
      prisma.bankProviderUser.findUnique.mockResolvedValue({
        providerUserId: 'sy-user-1',
      } as never);
      syncfy.listCredentials.mockResolvedValue([credential()]);
      await expect(service.register(userId, 'cred-other')).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe('sync', () => {
    it('only asks Syncfy to refresh when allowed and not too recently', async () => {
      arrangeSync();
      const fresh = await service.sync('conn-1', userId, {
        requestRefresh: true,
      });
      expect(syncfy.requestRefresh).toHaveBeenCalledWith(
        'session-token',
        'cred-1',
      );
      expect(fresh.refreshRequested).toBe(true);

      syncfy.requestRefresh.mockClear();
      arrangeSync({ credential: { ready_in: 600 } });
      await service.sync('conn-1', userId, { requestRefresh: true });
      expect(syncfy.requestRefresh).not.toHaveBeenCalled();

      arrangeSync({
        connection: { lastPullRequestedAt: new Date(Date.now() - 2 * 3600e3) },
      });
      await service.sync('conn-1', null, {
        requestRefresh: true,
        scheduled: true,
      });
      expect(syncfy.requestRefresh).not.toHaveBeenCalled();
    });

    it('still imports when Syncfy refuses the refresh (HTTP 402)', async () => {
      arrangeSync();
      syncfy.requestRefresh.mockRejectedValue(
        new SyncfyError(
          'Syncfy PUT /credentials/cred-1/pulls failed with HTTP 402',
          402,
        ),
      );
      const result = await service.sync('conn-1', userId, {
        requestRefresh: true,
      });
      expect(result.refreshRequested).toBe(false);
      // The import still runs: accounts are read and the sync finishes.
      expect(syncfy.listAccounts).toHaveBeenCalled();
      expect(prisma.bankConnection.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ lastSyncedAt: expect.any(Date) }),
        }),
      );
      expect(prisma.bankConnection.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lastPullRequestedAt: expect.any(Date),
          }),
        }),
      );
      expect(prisma.bankConnection.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: BankConnectionStatus.error,
          }),
        }),
      );
    });

    it('stores accounts with only the last 4 digits and takes the bank balance', async () => {
      arrangeSync();
      syncfy.listAccounts.mockResolvedValue([
        {
          id_account: 'sy-acc-card',
          id_credential: 'cred-1',
          account_type: 'Credit Card',
          name: 'Tarjeta',
          number: '5188999110401037',
          currency: 'MXN',
          balance: -48924.91,
          extra: { limit: '77000', available: '11653' },
        },
      ]);
      prisma.linkedAccount.upsert.mockResolvedValue(linkedRow());
      // Linked to a Finnit account and never reconciled: the first sync
      // takes the bank's balance as the start.
      prisma.linkedAccount.findMany.mockResolvedValue([linkedRow()] as never);
      prisma.linkedAccount.findUnique.mockResolvedValue(
        linkedRow({ balance: -48924.91 }),
      );
      syncfy.listTransactions.mockResolvedValue([]);
      prisma.importedTransaction.findMany.mockResolvedValue([]);

      await service.sync('conn-1', userId, { requestRefresh: false });

      expect(prisma.linkedAccount.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            mask: '1037',
            balance: -48924.91,
            creditLimit: 77000,
            availableCredit: 11653,
          }),
        }),
      );
      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: 'card-1' },
        data: { balanceCurrent: -48924.91 },
      });
    });

    it('imports new posted movements, reconciles and creates transactions', async () => {
      arrangeSync();
      prisma.linkedAccount.findMany.mockResolvedValue([linkedRow()] as never);
      syncfy.listTransactions.mockResolvedValue([
        {
          id_transaction: 'sy-1',
          id_account: 'sy-acc-card',
          description: 'NETFLIX COM 1 NME 110513PI3',
          amount: -448,
          dt_transaction: Date.UTC(2026, 9, 11) / 1000,
          dt_refresh: Date.UTC(2026, 9, 12, 5) / 1000,
        },
        {
          id_transaction: 'sy-pending',
          id_account: 'sy-acc-card',
          amount: -10,
          is_pending: 1,
          dt_transaction: Date.UTC(2026, 9, 12) / 1000,
        },
        {
          id_transaction: 'sy-deleted',
          id_account: 'sy-acc-card',
          amount: -20,
          is_deleted: 1,
          dt_transaction: Date.UTC(2026, 9, 12) / 1000,
        },
      ]);
      prisma.importedTransaction.findUnique.mockResolvedValue(null);
      const line = { id: 'line-1', providerTxnId: 'sy-1' };
      prisma.importedTransaction.findMany
        .mockResolvedValueOnce([]) // "meses sin intereses" reversals
        .mockResolvedValueOnce([line] as never) // pending lines
        .mockResolvedValueOnce([line] as never); // after reconciliation
      materializer.materialize.mockResolvedValue({
        created: 1,
        balanceChange: -448,
        settledChange: 0,
      });

      const result = await service.sync('conn-1', userId, {
        requestRefresh: false,
      });

      // Incremental read from the cursor minus the 2-day overlap.
      expect(syncfy.listTransactions).toHaveBeenCalledWith(
        'session-token',
        'sy-acc-card',
        { refreshedSince: new Date('2026-10-08T00:00:00Z') },
      );
      expect(prisma.importedTransaction.create).toHaveBeenCalledTimes(1);
      expect(prisma.importedTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          providerTxnId: 'sy-1',
          linkedAccountId: 'linked-card',
          accountId: 'card-1',
          kind: ImportedLineKind.charge,
          amount: 448,
        }),
      });
      expect(reconciliation.reconcileLines).toHaveBeenCalledWith(
        userId,
        'card-1',
        expect.any(Array),
        'bank',
      );
      const options = materializer.materialize.mock.calls[0][2];
      expect(options).toEqual(
        expect.objectContaining({
          source: TransactionSource.imported,
          matchedBy: OccurrenceMatchSource.bank,
          adjustBalance: false,
        }),
      );
      expect(options.externalId?.({ providerTxnId: 'sy-1' } as never)).toBe(
        'syncfy:sy-1',
      );
      expect(result).toEqual(
        expect.objectContaining({ imported: 1, created: 1 }),
      );
      expect(prisma.bankConnection.update).toHaveBeenLastCalledWith({
        where: { id: 'conn-1' },
        data: expect.objectContaining({
          status: BankConnectionStatus.active,
          transactionsCursor: new Date('2026-10-12T05:00:00Z'),
        }),
      });
    });

    it('marks the connection with a clear message when the bank rejects the login', async () => {
      arrangeSync({ credential: { is_authorized: 0, code: 401 } });
      await service.sync('conn-1', userId, { requestRefresh: true });
      expect(syncfy.requestRefresh).not.toHaveBeenCalled();
      expect(prisma.bankConnection.update).toHaveBeenLastCalledWith({
        where: { id: 'conn-1' },
        data: expect.objectContaining({
          status: BankConnectionStatus.error,
          lastStatusCode: 401,
          errorMessage:
            'The bank rejected the login details; reconnect the bank with the right ones',
        }),
      });
    });

    it('records Syncfy failures without leaking details', async () => {
      arrangeSync();
      syncfy.listCredentials.mockRejectedValue(
        new SyncfyError('Syncfy GET /credentials failed with HTTP 500', 500),
      );
      await expect(
        service.sync('conn-1', userId, { requestRefresh: false }),
      ).rejects.toThrow(ValidationError);
      expect(prisma.bankConnection.update).toHaveBeenCalledWith({
        where: { id: 'conn-1' },
        data: {
          status: BankConnectionStatus.error,
          errorMessage: 'Syncfy GET /credentials failed with HTTP 500',
        },
      });
    });

    it('rejects a second sync of the same connection while one runs', async () => {
      arrangeSync();
      let release!: () => void;
      syncfy.listCredentials.mockReturnValue(
        new Promise((resolve) => {
          release = () => resolve([credential()]);
        }),
      );
      const first = service.sync('conn-1', userId, { requestRefresh: false });
      await new Promise((r) => setImmediate(r));
      await expect(
        service.sync('conn-1', userId, { requestRefresh: false }),
      ).rejects.toThrow(ConflictError);
      release();
      await first;
    });

    it('ignores a purchase converted to "meses sin intereses" and its reversal', async () => {
      arrangeSync();
      prisma.linkedAccount.findMany.mockResolvedValue([linkedRow()] as never);
      syncfy.listTransactions.mockResolvedValue([]);
      const reversal = {
        id: 'line-rev',
        kind: ImportedLineKind.refund,
        status: ImportedLineStatus.pending,
        amount: new Prisma.Decimal(899),
        date: new Date('2026-09-03'),
        matchedTransactionId: null,
      };
      const purchase = {
        id: 'line-buy',
        kind: ImportedLineKind.charge,
        status: ImportedLineStatus.created,
        amount: new Prisma.Decimal(899),
        date: new Date('2026-09-02'),
        matchedTransactionId: 'txn-buy',
      };
      prisma.importedTransaction.findMany
        .mockResolvedValueOnce([reversal] as never)
        .mockResolvedValueOnce([]);
      prisma.importedTransaction.findFirst.mockResolvedValue(purchase as never);
      prisma.transaction.findUnique.mockResolvedValue({
        id: 'txn-buy',
        source: TransactionSource.imported,
        transferFrom: null,
        transferTo: null,
        debtPayment: null,
        goalContributions: [],
        recurringPayment: null,
        importedMatches: [{ id: 'line-buy' }],
      } as never);

      await service.sync('conn-1', userId, { requestRefresh: false });

      expect(prisma.transaction.delete).toHaveBeenCalledWith({
        where: { id: 'txn-buy' },
      });
      for (const id of ['line-rev', 'line-buy']) {
        expect(prisma.importedTransaction.update).toHaveBeenCalledWith({
          where: { id },
          data: {
            status: ImportedLineStatus.ignored,
            matchedTransactionId: null,
          },
        });
      }
    });
    it('ignores an installment reversal whose purchase is not in the history', async () => {
      arrangeSync();
      prisma.linkedAccount.findMany.mockResolvedValue([linkedRow()] as never);
      syncfy.listTransactions.mockResolvedValue([]);
      prisma.importedTransaction.findMany
        .mockResolvedValueOnce([
          {
            id: 'line-rev',
            kind: ImportedLineKind.refund,
            status: ImportedLineStatus.pending,
            amount: new Prisma.Decimal(1200),
            date: new Date('2026-09-03'),
            matchedTransactionId: null,
          },
        ] as never)
        .mockResolvedValueOnce([]);
      prisma.importedTransaction.findFirst.mockResolvedValue(null);

      await service.sync('conn-1', userId, { requestRefresh: false });

      expect(prisma.importedTransaction.update).toHaveBeenCalledTimes(1);
      expect(prisma.importedTransaction.update).toHaveBeenCalledWith({
        where: { id: 'line-rev' },
        data: {
          status: ImportedLineStatus.ignored,
          matchedTransactionId: null,
        },
      });
    });
  });

  describe('linkProviderUser', () => {
    it('maps a Finnit user to an existing Syncfy user by external id', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: userId } as never);
      syncfy.listUsers.mockResolvedValue([
        { id_user: 'sy-test', id_external: 'finnit-owner' },
      ]);
      prisma.bankProviderUser.findUnique.mockResolvedValue(null);

      await service.linkProviderUser('me@finnit.app', 'finnit-owner');

      expect(prisma.bankProviderUser.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: {
            userId,
            provider: BankProvider.syncfy,
            providerUserId: 'sy-test',
          },
        }),
      );
    });

    it('refuses a Syncfy user already linked to someone else', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: userId } as never);
      syncfy.listUsers.mockResolvedValue([{ id_user: 'sy-test' }]);
      prisma.bankProviderUser.findUnique.mockResolvedValue({
        userId: 'other',
      } as never);
      await expect(
        service.linkProviderUser('me@finnit.app', 'sy-test'),
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('balance reconciliation', () => {
    const since = new Date('2026-11-02T13:00:00Z');
    const arrange = ({
      bank,
      recorded,
      open,
    }: {
      bank: number;
      recorded: number;
      open: { id: string; balanceEffect: number } | null;
    }) => {
      prisma.linkedAccount.findUnique.mockResolvedValue(
        linkedRow({
          balance: bank,
          reconciledBalance: 1000,
          reconciledAt: since,
        }),
      );
      prisma.account.findUniqueOrThrow.mockResolvedValue({
        id: 'card-1',
        userId,
        name: 'BancaNet MiCuenta',
        metadata: { nickname: 'Mi Cuenta' },
        currency: 'MXN',
        bankDifferenceTransaction: open,
      } as never);
      prisma.transaction.aggregate.mockResolvedValue({
        _sum: { balanceEffect: recorded },
      } as never);
      prisma.user.findUnique.mockResolvedValue({ locale: 'es' } as never);
      prisma.transaction.create.mockResolvedValue({ id: 'diff' } as never);
    };
    const reconcile = () =>
      (
        service as unknown as {
          reconcileBalance: (id: string, user: string) => Promise<void>;
        }
      ).reconcileBalance('linked-card', userId);

    it('keeps what the movements do not explain as one adjustment, without telling yet', async () => {
      arrange({ bank: 650, recorded: -200, open: null });

      await reconcile();

      expect(prisma.transaction.aggregate).toHaveBeenCalledWith({
        where: {
          accountId: 'card-1',
          isPending: false,
          createdAt: { gt: since },
        },
        _sum: { balanceEffect: true },
      });
      expect(prisma.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'adjustment',
          amount: 150,
          balanceEffect: -150,
          description: 'Diferencia con el banco',
        }),
      });
      expect(prisma.account.update).toHaveBeenLastCalledWith({
        where: { id: 'card-1' },
        data: { balanceCurrent: 650, bankDifferenceTransactionId: 'diff' },
      });
      expect(prisma.linkedAccount.update).toHaveBeenCalledWith({
        where: { id: 'linked-card' },
        data: { reconciledBalance: 650, reconciledAt: expect.any(Date) },
      });
      expect(notifications.notify).not.toHaveBeenCalled();
    });

    it('tells the user when the difference is still there on the next sync', async () => {
      arrange({
        bank: 650,
        recorded: 0,
        open: { id: 'diff', balanceEffect: -150 },
      });
      // Reconciled at 1,000 with 150 open: 150 less again.
      prisma.linkedAccount.findUnique.mockResolvedValue(
        linkedRow({
          balance: 500,
          reconciledBalance: 650,
          reconciledAt: since,
        }),
      );

      await reconcile();

      expect(prisma.transaction.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: { not: 'diff' } }),
        }),
      );
      expect(prisma.transaction.update).toHaveBeenCalledWith({
        where: { id: 'diff' },
        data: { amount: 300, balanceEffect: -300 },
      });
      expect(notifications.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          type: 'balance_mismatch',
          title: 'Mi Cuenta: el saldo no coincide con el banco',
          relatedEntityType: 'account_balance_mismatch',
          relatedEntityId: expect.stringMatching(/^card-1:\d{4}-\d{2}-\d{2}$/),
        }),
      );
    });

    it('removes the adjustment once the missing movement is recorded', async () => {
      arrange({
        bank: 650,
        recorded: -150,
        open: { id: 'diff', balanceEffect: -150 },
      });
      prisma.linkedAccount.findUnique.mockResolvedValue(
        linkedRow({
          balance: 650,
          reconciledBalance: 650,
          reconciledAt: since,
        }),
      );

      await reconcile();

      expect(prisma.transaction.delete).toHaveBeenCalledWith({
        where: { id: 'diff' },
      });
      expect(prisma.account.update).toHaveBeenLastCalledWith({
        where: { id: 'card-1' },
        data: { balanceCurrent: 650, bankDifferenceTransactionId: null },
      });
      expect(notifications.notify).not.toHaveBeenCalled();
    });
  });
});
