import { Injectable, Logger } from '@nestjs/common';
import {
  AccountType,
  BankConnectionStatus,
  BankProvider,
  ImportedLineKind,
  ImportedLineStatus,
  OccurrenceMatchSource,
  Prisma,
  TransactionSource,
  type BankConnection as BankConnectionRow,
  type ImportedTransaction as ImportedTransactionRow,
  type LinkedAccount as LinkedAccountRow,
} from '@finnit/database';
import { PrismaService } from '../../services/prisma.service';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../common/exceptions/graphql-error.exception';
import { ReconciliationService } from '../statements/reconciliation/reconciliation.service';
import { LineMaterializerService } from '../statements/reconciliation/line-materializer.service';
import { addDays, toDateOnly } from '../recurring-expenses/schedule.util';
import {
  BankConnection,
  BankSyncResult,
  BankConnectSession,
  LinkBankAccountInput,
} from './dto/bank-connection.dto';
import {
  SyncfyClient,
  SyncfyCredential,
  SyncfyError,
  SyncfyTransaction,
} from './syncfy/syncfy.client';
import {
  isCreditAccount,
  mapTransaction,
  maskNumber,
  suggestedAccountType,
  toNumber,
} from './syncfy/syncfy.mapper';

/** History imported the first time an account is linked. */
export const INITIAL_HISTORY_DAYS = 90;
/** Re-read this much before the cursor: Syncfy may refresh old movements late. */
const CURSOR_OVERLAP_DAYS = 2;
/** Ask Syncfy to log in to the bank at most this often. */
export const MIN_REFRESH_INTERVAL_HOURS = { scheduled: 20, manual: 1 };
/** A card purchase converted to "meses sin intereses" is reversed within this window. */
const MSI_CONVERSION_WINDOW_DAYS = 15;

const WIDGET_SCRIPT =
  'https://www.syncfy.com/widget/v3/syncfy-authentication-widget.js';
const WIDGET_STYLESHEET =
  'https://www.syncfy.com/widget/v3/syncfy-authentication-widget.css';

/** Syncfy job codes (sync-widget codes.md) that need the user to act. */
const USER_ACTION_CODES: Record<number, string> = {
  401: 'The bank rejected the login details; reconnect the bank with the right ones',
  403: 'The bank rejected the security code or it expired; reconnect the bank',
  405: 'The bank locked the access; contact the bank before reconnecting',
  406: 'The bank allows one session at a time; log out elsewhere and sync again',
  408: 'The bank needs attention; log in to online banking, then sync again',
  409: 'These login details belong to another service of the same bank',
  410: 'The bank asks for a security code; reconnect the bank',
  411: 'The security code was not entered in time; reconnect the bank',
  413: 'The bank login failed; sync again',
};

type ConnectionWithAccounts = BankConnectionRow & {
  linkedAccounts: LinkedAccountRow[];
};

/**
 * Bank aggregation through Syncfy. Users connect their bank in Syncfy's
 * widget (Finnit never handles bank logins); Finnit stores only Syncfy ids,
 * imports movements of the accounts the user links, reconciles them and
 * creates the transactions.
 */
@Injectable()
export class BankConnectionsService {
  private readonly logger = new Logger(BankConnectionsService.name);
  /** Connections being synced; a second sync of the same one is rejected. */
  private readonly syncing = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly syncfy: SyncfyClient,
    private readonly reconciliation: ReconciliationService,
    private readonly materializer: LineMaterializerService,
  ) {}

  async connectSession(userId: string): Promise<BankConnectSession> {
    this.requireConfigured();
    const providerUserId = await this.ensureProviderUser(userId);
    return {
      provider: BankProvider.syncfy,
      token: await this.syncfy.createSession(providerUserId),
      widgetScriptUrl: WIDGET_SCRIPT,
      widgetStylesheetUrl: WIDGET_STYLESHEET,
    };
  }

  /** Registers the credential the widget just created, then imports accounts. */
  async register(
    userId: string,
    idCredential: string,
  ): Promise<BankSyncResult> {
    this.requireConfigured();
    const providerUserId = await this.ensureProviderUser(userId);
    const token = await this.syncfy.createSession(providerUserId);
    const credential = (await this.syncfy.listCredentials(token)).find(
      (c) => c.id_credential === idCredential,
    );
    if (!credential) {
      throw new NotFoundError('Bank connection not found for this user');
    }

    const existing = await this.prisma.bankConnection.findUnique({
      where: { providerItemId: idCredential },
    });
    if (existing && existing.userId !== userId) {
      throw new ConflictError('This bank connection belongs to another user');
    }

    const institution = await this.syncfy
      .listSites(token)
      .then(
        (sites) => sites.find((s) => s.id_site === credential.id_site)?.name,
      )
      .catch(() => undefined);

    const connection =
      existing ??
      (await this.prisma.bankConnection.create({
        data: {
          userId,
          provider: BankProvider.syncfy,
          providerItemId: idCredential,
          providerUserId,
          institution,
          status: BankConnectionStatus.active,
        },
      }));
    return this.sync(connection.id, userId, { requestRefresh: false });
  }

  async list(userId: string): Promise<BankConnection[]> {
    const rows = await this.prisma.bankConnection.findMany({
      where: { userId },
      include: { linkedAccounts: { orderBy: { officialName: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => this.map(row));
  }

  /**
   * Links a bank account to a Finnit account (or creates one) and imports its
   * last INITIAL_HISTORY_DAYS of movements.
   */
  async linkAccount(
    userId: string,
    linkedAccountId: string,
    input: LinkBankAccountInput,
  ): Promise<BankSyncResult> {
    const linked = await this.prisma.linkedAccount.findFirst({
      where: { id: linkedAccountId, bankConnection: { userId } },
      include: { bankConnection: true },
    });
    if (!linked) throw new NotFoundError('Bank account not found');
    if (!input.accountId && !input.createAccount) {
      throw new ValidationError('Pass accountId or createAccount: true');
    }

    const expectedType =
      linked.type && isCreditAccount({ account_type: linked.type })
        ? AccountType.credit
        : null;
    let accountId = input.accountId;

    if (accountId) {
      const account = await this.prisma.account.findFirst({
        where: { id: accountId, userId },
        include: { linkedAccounts: { select: { id: true } } },
      });
      if (!account) throw new NotFoundError('Account not found');
      if (
        expectedType === AccountType.credit &&
        account.type !== AccountType.credit
      ) {
        throw new ValidationError(
          'A credit card must link to a credit account',
        );
      }
      if (account.linkedAccounts.some((l) => l.id !== linked.id)) {
        throw new ConflictError(
          'That account is already linked to another bank account',
        );
      }
    } else {
      const type = suggestedAccountType({
        id_account: linked.providerAccountId,
        id_credential: linked.bankConnection.providerItemId,
        account_type: linked.type ?? 'Checking',
      });
      const base =
        `${linked.bankConnection.institution ?? 'Banco'} ${linked.officialName ?? ''}`.trim();
      const name = linked.mask ? `${base} ·${linked.mask}` : base;
      const account = await this.prisma.account.create({
        data: {
          userId,
          type,
          name: await this.uniqueAccountName(userId, name),
          currency: linked.currency ?? 'MXN',
          balanceCurrent: linked.balance ?? 0,
        },
      });
      accountId = account.id;
    }

    await this.prisma.linkedAccount.update({
      where: { id: linked.id },
      data: { accountId },
    });
    return this.sync(linked.bankConnectionId, userId, {
      requestRefresh: false,
      initialImportFor: linked.id,
    });
  }

  async unlinkAccount(
    userId: string,
    linkedAccountId: string,
  ): Promise<BankConnection> {
    const linked = await this.prisma.linkedAccount.findFirst({
      where: { id: linkedAccountId, bankConnection: { userId } },
    });
    if (!linked) throw new NotFoundError('Bank account not found');
    await this.prisma.linkedAccount.update({
      where: { id: linked.id },
      data: { accountId: null },
    });
    return this.get(linked.bankConnectionId, userId);
  }

  /**
   * Removes the connection from Finnit (imported transactions stay). The
   * bank login itself stays in Syncfy until it is deleted there.
   */
  async delete(userId: string, id: string): Promise<boolean> {
    await this.getRow(id, userId);
    await this.prisma.bankConnection.delete({ where: { id } });
    return true;
  }

  /**
   * Imports what Syncfy has for the connection. With `requestRefresh`, also
   * asks Syncfy to log in to the bank again (rate limited); that job's
   * results arrive on the next sync.
   */
  async sync(
    id: string,
    userId: string | null,
    options: {
      requestRefresh: boolean;
      scheduled?: boolean;
      initialImportFor?: string;
    },
  ): Promise<BankSyncResult> {
    this.requireConfigured();
    const connection = await this.getRow(id, userId);
    if (this.syncing.has(id)) {
      throw new ConflictError('This bank connection is already syncing');
    }
    this.syncing.add(id);

    try {
      const token = await this.syncfy.createSession(connection.providerUserId!);
      const credential = (await this.syncfy.listCredentials(token)).find(
        (c) => c.id_credential === connection.providerItemId,
      );
      if (!credential) {
        await this.prisma.bankConnection.update({
          where: { id },
          data: {
            status: BankConnectionStatus.revoked,
            errorMessage: 'The bank connection no longer exists in Syncfy',
          },
        });
        return this.result(id, 0, 0, false);
      }

      const refreshRequested = await this.maybeRequestRefresh(
        connection,
        credential,
        token,
        options,
      );
      await this.upsertAccounts(connection, token);

      let imported = 0;
      let created = 0;
      const linkedAccounts = await this.prisma.linkedAccount.findMany({
        where: { bankConnectionId: id, accountId: { not: null } },
      });
      const cursor = connection.transactionsCursor;
      let newCursor = cursor;

      for (const linked of linkedAccounts) {
        const initial = options.initialImportFor === linked.id || !cursor;
        const transactions = await this.syncfy.listTransactions(
          token,
          linked.providerAccountId,
          initial
            ? { from: addDays(toDateOnly(new Date()), -INITIAL_HISTORY_DAYS) }
            : { refreshedSince: addDays(cursor, -CURSOR_OVERLAP_DAYS) },
        );
        const result = await this.importTransactions(
          connection.userId,
          linked,
          transactions,
        );
        imported += result.imported;
        created += result.created;
        for (const t of transactions) {
          if (t.dt_refresh) {
            const refreshed = new Date(t.dt_refresh * 1000);
            if (!newCursor || refreshed > newCursor) newCursor = refreshed;
          }
        }
      }

      await this.prisma.bankConnection.update({
        where: { id },
        data: {
          status: credential.is_authorized
            ? BankConnectionStatus.active
            : BankConnectionStatus.error,
          lastStatusCode: credential.code ?? null,
          errorMessage: credential.is_authorized
            ? null
            : (USER_ACTION_CODES[credential.code ?? 0] ??
              'The bank connection needs attention; reconnect the bank'),
          lastSyncedAt: new Date(),
          transactionsCursor: newCursor ?? new Date(),
        },
      });
      return this.result(id, imported, created, refreshRequested);
    } catch (error) {
      const message =
        error instanceof SyncfyError
          ? error.message
          : 'The bank connection could not be synced';
      this.logger.warn(`Bank connection ${id} sync failed: ${message}`);
      await this.prisma.bankConnection.update({
        where: { id },
        data: { status: BankConnectionStatus.error, errorMessage: message },
      });
      throw error instanceof SyncfyError ? new ValidationError(message) : error;
    } finally {
      this.syncing.delete(id);
    }
  }

  /** Daily job: refresh and import every active Syncfy connection, one by one. */
  async syncAll(): Promise<{ synced: number; failed: number }> {
    if (!this.syncfy.isConfigured) return { synced: 0, failed: 0 };
    const connections = await this.prisma.bankConnection.findMany({
      where: {
        provider: BankProvider.syncfy,
        status: { not: BankConnectionStatus.revoked },
      },
      select: { id: true },
    });
    let synced = 0;
    let failed = 0;
    for (const { id } of connections) {
      try {
        await this.sync(id, null, { requestRefresh: true, scheduled: true });
        synced += 1;
      } catch {
        failed += 1;
      }
    }
    return { synced, failed };
  }

  /** Admin: maps a Finnit user to an existing Syncfy user (e.g. one created in tests). */
  async linkProviderUser(email: string, syncfyUser: string): Promise<boolean> {
    this.requireConfigured();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new NotFoundError('User not found');
    const match = (await this.syncfy.listUsers()).find(
      (u) => u.id_user === syncfyUser || u.id_external === syncfyUser,
    );
    if (!match) throw new NotFoundError('Syncfy user not found');

    const taken = await this.prisma.bankProviderUser.findUnique({
      where: {
        provider_providerUserId: {
          provider: BankProvider.syncfy,
          providerUserId: match.id_user,
        },
      },
    });
    if (taken && taken.userId !== user.id) {
      throw new ConflictError('That Syncfy user is linked to another account');
    }
    await this.prisma.bankProviderUser.upsert({
      where: {
        provider_userId: { provider: BankProvider.syncfy, userId: user.id },
      },
      create: {
        userId: user.id,
        provider: BankProvider.syncfy,
        providerUserId: match.id_user,
      },
      update: { providerUserId: match.id_user },
    });
    return true;
  }

  private async maybeRequestRefresh(
    connection: BankConnectionRow,
    credential: SyncfyCredential,
    token: string,
    options: { requestRefresh: boolean; scheduled?: boolean },
  ): Promise<boolean> {
    if (!options.requestRefresh) return false;
    if (
      !credential.can_sync ||
      credential.ready_in > 0 ||
      !credential.is_authorized
    ) {
      return false;
    }
    const hours = options.scheduled
      ? MIN_REFRESH_INTERVAL_HOURS.scheduled
      : MIN_REFRESH_INTERVAL_HOURS.manual;
    const last = connection.lastPullRequestedAt;
    if (last && Date.now() - last.getTime() < hours * 3_600_000) return false;

    await this.syncfy.requestRefresh(token, connection.providerItemId);
    await this.prisma.bankConnection.update({
      where: { id: connection.id },
      data: { lastPullRequestedAt: new Date() },
    });
    return true;
  }

  private async upsertAccounts(connection: BankConnectionRow, token: string) {
    const accounts = await this.syncfy.listAccounts(
      token,
      connection.providerItemId,
    );
    const now = new Date();

    for (const account of accounts) {
      const credit = isCreditAccount(account);
      const data = {
        officialName: account.name ?? null,
        mask: maskNumber(account.number) ?? null,
        type: account.account_type,
        currency: (account.currency ?? 'MXN').toUpperCase(),
        balance: toNumber(account.balance) ?? null,
        creditLimit: credit ? (toNumber(account.extra?.limit) ?? null) : null,
        availableCredit: credit
          ? (toNumber(account.extra?.available) ?? null)
          : null,
        balanceUpdatedAt: now,
      };
      const linked = await this.prisma.linkedAccount.upsert({
        where: { providerAccountId: account.id_account },
        create: {
          bankConnectionId: connection.id,
          providerAccountId: account.id_account,
          ...data,
        },
        update: data,
      });
      // The bank is the source of truth for the balance of a linked account.
      if (linked.accountId && data.balance !== null) {
        await this.prisma.account.update({
          where: { id: linked.accountId },
          data: { balanceCurrent: data.balance },
        });
      }
    }
  }

  private async importTransactions(
    userId: string,
    linked: LinkedAccountRow,
    transactions: SyncfyTransaction[],
  ): Promise<{ imported: number; created: number }> {
    const accountId = linked.accountId!;
    const account = {
      account_type: linked.type ?? 'Checking',
      currency: linked.currency,
    };
    let imported = 0;

    for (const transaction of transactions) {
      // Card authorizations change before they post; import them once posted.
      if (transaction.is_pending) continue;
      const removed = Boolean(transaction.is_deleted || transaction.is_disable);
      const existing = await this.prisma.importedTransaction.findUnique({
        where: { providerTxnId: transaction.id_transaction },
      });

      if (existing) {
        if (removed && existing.status !== ImportedLineStatus.created) {
          await this.prisma.importedTransaction.update({
            where: { id: existing.id },
            data: { status: ImportedLineStatus.ignored },
          });
        }
        continue;
      }
      if (removed) continue;

      const line = mapTransaction(transaction, account);
      await this.prisma.importedTransaction.create({
        data: {
          accountId,
          linkedAccountId: linked.id,
          providerTxnId: line.providerTxnId,
          kind: line.kind,
          amount: line.amount,
          currency: line.currency,
          date: line.date,
          postDate: line.postDate,
          description: line.description,
          merchant: line.merchant,
          installmentNumber: line.installmentNumber,
          installmentTotal: line.installmentTotal,
        },
      });
      imported += 1;
    }

    if (isCreditAccount(account)) {
      await this.ignoreInstallmentConversions(linked.id);
    }

    const pending = await this.prisma.importedTransaction.findMany({
      where: { linkedAccountId: linked.id, status: ImportedLineStatus.pending },
    });
    if (pending.length === 0) return { imported, created: 0 };

    await this.reconciliation.reconcileLines(
      userId,
      accountId,
      pending,
      'bank',
    );
    const reconciled = await this.prisma.importedTransaction.findMany({
      where: { id: { in: pending.map((line) => line.id) } },
    });
    const { created } = await this.prisma.$transaction(
      (tx) =>
        this.materializer.materialize(tx, reconciled, {
          userId,
          accountId,
          source: TransactionSource.imported,
          matchedBy: OccurrenceMatchSource.bank,
          adjustBalance: false,
          externalId: (line) =>
            line.providerTxnId ? `syncfy:${line.providerTxnId}` : undefined,
        }),
      { timeout: 60_000 },
    );
    return { imported, created };
  }

  /**
   * When a card purchase is converted to "meses sin intereses", the bank
   * reverses it with a credit of the same amount and then charges monthly
   * installments. Spending is the installments, so the reversal and, when it
   * is in the imported history, the original charge are ignored (removing
   * any transaction this sync already created for them).
   */
  private async ignoreInstallmentConversions(linkedAccountId: string) {
    const reversals = await this.prisma.importedTransaction.findMany({
      where: {
        linkedAccountId,
        kind: ImportedLineKind.refund,
        status: { not: ImportedLineStatus.ignored },
        description: { contains: 'MESES', mode: 'insensitive' },
      },
    });
    for (const reversal of reversals) {
      const original = await this.prisma.importedTransaction.findFirst({
        where: {
          linkedAccountId,
          kind: ImportedLineKind.charge,
          amount: reversal.amount,
          status: { not: ImportedLineStatus.ignored },
          date: {
            gte: addDays(reversal.date, -MSI_CONVERSION_WINDOW_DAYS),
            lte: reversal.date,
          },
        },
        orderBy: { date: 'desc' },
      });
      // The reversal is never spending or income; its purchase may predate
      // the imported history, in which case only the reversal is ignored.
      await this.prisma.$transaction(async (tx) => {
        for (const line of original ? [reversal, original] : [reversal]) {
          await this.removeCreatedTransaction(tx, line);
          await tx.importedTransaction.update({
            where: { id: line.id },
            data: {
              status: ImportedLineStatus.ignored,
              matchedTransactionId: null,
            },
          });
        }
      });
    }
  }

  /** Deletes a transaction this sync created, unless something else uses it. */
  private async removeCreatedTransaction(
    tx: Prisma.TransactionClient,
    line: ImportedTransactionRow,
  ) {
    if (
      line.status !== ImportedLineStatus.created ||
      !line.matchedTransactionId
    ) {
      return;
    }
    const transaction = await tx.transaction.findUnique({
      where: { id: line.matchedTransactionId },
      include: {
        transferFrom: true,
        transferTo: true,
        debtPayment: true,
        goalContributions: true,
        recurringPayment: true,
        importedMatches: { select: { id: true } },
      },
    });
    if (
      !transaction ||
      transaction.source !== TransactionSource.imported ||
      transaction.transferFrom ||
      transaction.transferTo ||
      transaction.debtPayment ||
      transaction.goalContributions.length > 0 ||
      transaction.recurringPayment ||
      transaction.importedMatches.some((m) => m.id !== line.id)
    ) {
      return;
    }
    await tx.transaction.delete({ where: { id: transaction.id } });
  }

  private async ensureProviderUser(userId: string): Promise<string> {
    const mapping = await this.prisma.bankProviderUser.findUnique({
      where: { provider_userId: { provider: BankProvider.syncfy, userId } },
    });
    if (mapping) return mapping.providerUserId;

    // The Syncfy user is tagged with the Finnit user id, never with personal data.
    const existing = (await this.syncfy.listUsers()).find(
      (u) => u.id_external === userId,
    );
    const syncfyUser =
      existing ??
      (await this.syncfy.createUser(userId, `finnit-${userId.slice(0, 8)}`));
    await this.prisma.bankProviderUser.create({
      data: {
        userId,
        provider: BankProvider.syncfy,
        providerUserId: syncfyUser.id_user,
      },
    });
    return syncfyUser.id_user;
  }

  private async uniqueAccountName(
    userId: string,
    name: string,
  ): Promise<string> {
    for (let n = 1; ; n += 1) {
      const candidate = n === 1 ? name : `${name} (${n})`;
      const taken = await this.prisma.account.findFirst({
        where: { userId, name: candidate },
        select: { id: true },
      });
      if (!taken) return candidate;
    }
  }

  private requireConfigured() {
    if (!this.syncfy.isConfigured) {
      throw new ValidationError('Bank sync is not configured on this server');
    }
  }

  private async getRow(
    id: string,
    userId: string | null,
  ): Promise<BankConnectionRow> {
    const row = await this.prisma.bankConnection.findFirst({
      where: { id, ...(userId && { userId }) },
    });
    if (!row) throw new NotFoundError('Bank connection not found');
    if (row.provider !== BankProvider.syncfy || !row.providerUserId) {
      throw new ValidationError('Only Syncfy connections can be synced');
    }
    return row;
  }

  private async get(id: string, userId: string): Promise<BankConnection> {
    const row = await this.prisma.bankConnection.findFirst({
      where: { id, userId },
      include: { linkedAccounts: { orderBy: { officialName: 'asc' } } },
    });
    if (!row) throw new NotFoundError('Bank connection not found');
    return this.map(row);
  }

  private async result(
    id: string,
    imported: number,
    created: number,
    refreshRequested: boolean,
  ): Promise<BankSyncResult> {
    const row = await this.prisma.bankConnection.findUniqueOrThrow({
      where: { id },
      include: { linkedAccounts: { orderBy: { officialName: 'asc' } } },
    });
    return { connection: this.map(row), imported, created, refreshRequested };
  }

  private map(row: ConnectionWithAccounts): BankConnection {
    const money = (value: Prisma.Decimal | null) =>
      value === null ? undefined : Number(value);
    return {
      id: row.id,
      provider: row.provider,
      institution: row.institution ?? undefined,
      status: row.status,
      lastStatusCode: row.lastStatusCode ?? undefined,
      errorMessage: row.errorMessage ?? undefined,
      lastSyncedAt: row.lastSyncedAt ?? undefined,
      createdAt: row.createdAt,
      accounts: row.linkedAccounts.map((linked) => ({
        id: linked.id,
        accountId: linked.accountId ?? undefined,
        name: linked.officialName ?? undefined,
        mask: linked.mask ?? undefined,
        type: linked.type ?? undefined,
        currency: linked.currency ?? undefined,
        balance: money(linked.balance),
        creditLimit: money(linked.creditLimit),
        availableCredit: money(linked.availableCredit),
        balanceUpdatedAt: linked.balanceUpdatedAt ?? undefined,
      })),
    };
  }
}
