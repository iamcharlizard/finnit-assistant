import { Injectable, Logger } from '@nestjs/common';
import {
  AccountType,
  AiFeatureKey,
  OccurrenceMatchSource,
  Prisma,
  RecurringExpenseKind,
  RecurringTrackingMode,
  TransactionSource,
  TransactionType,
  type RecurringSuggestionState as StateRow,
} from '@finnit/database';
import { PrismaService } from '../../../services/prisma.service';
import {
  NotFoundError,
  ValidationError,
} from '../../../common/exceptions/graphql-error.exception';
import { Account } from '../../../common/types/models/account.model';
import { AccountMetadata } from '../../../common/types/models/account-metadata.model';
import { Category } from '../../../common/types/models/category.model';
import { AiModelsService } from '../../ai/ai-models.service';
import { JsonSchema } from '../../ai/providers/ai-provider';
import { AppLocale, DEFAULT_LOCALE } from '../../translation/locale';
import { RecurringExpense } from '../dto/recurring-expense.dto';
import {
  PaidHistoryItem,
  RecurringExpensesService,
} from '../recurring-expenses.service';
import { addDays, toDateOnly } from '../schedule.util';
import { presentTransaction } from '../../transactions/transaction.mapper';
import {
  DetectedSuggestion,
  FREQUENCY_DAYS,
  SUGGESTION_LOOKBACK_DAYS,
  detectRecurring,
} from './detect';
import {
  AcceptRecurringSuggestionInput,
  RecurringSuggestion,
} from './recurring-suggestion.dto';

/** Suggestions classified per AI call; the rest wait for the next request. */
export const MAX_AI_BATCH = 30;
export const AI_TIMEOUT_MS = 15_000;
const MAX_NAME_LENGTH = 60;
const FINGERPRINT = /^[A-Za-z0-9_-]{1,64}$/;

/** Kinds the AI may pick (installments come from statements, not here). */
const AI_KINDS: RecurringExpenseKind[] = [
  RecurringExpenseKind.subscription,
  RecurringExpenseKind.utility,
  RecurringExpenseKind.loan,
  RecurringExpenseKind.insurance,
  RecurringExpenseKind.housing,
  RecurringExpenseKind.membership,
  RecurringExpenseKind.other,
];

const AI_PROMPT = `You classify recurring payments detected in a Mexican user's bank movements, for a personal-finance app.
The input is JSON: "payments" (each with a ref, the merchant text as printed by the bank, the typical amount, currency, how often it is charged and how many times it was seen) and "categories" (the user's spending categories: id and name, "Parent > Child" for subcategories).
For every payment return:
- ref: the payment's ref, unchanged.
- name: a short, human name for the payment as the user knows it (the brand or service, e.g. "Netflix", "Spotify", "Apple iCloud", "CFE (luz)", "Telcel"). Drop bank prefixes like "DLO*", "KSK*", "PAYU *", city names and legal suffixes. Generic words in {{language}}.
- kind: subscription (streaming, apps, software), utility (power, water, gas, internet, phone), loan, insurance, housing (rent, maintenance fees), membership (gym, clubs) or other.
- categoryId: the id of the best matching category from the list, or null when none fits. Prefer subcategories.`;

const AI_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    payments: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ref: { type: 'string' },
          name: { type: 'string' },
          kind: { type: 'string', enum: AI_KINDS },
          categoryId: {
            type: 'string',
            description: 'Category id from the list; empty when none fits',
          },
        },
        required: ['ref', 'name', 'kind'],
      },
    },
  },
  required: ['payments'],
};

const LANGUAGE: Record<AppLocale, string> = {
  es: 'Mexican Spanish',
  en: 'English',
};

interface AiClassification {
  aiName: string | null;
  aiKind: RecurringExpenseKind | null;
  aiCategoryId: string | null;
}

type CategoryRow = Prisma.CategoryGetPayload<{
  include: { translations: { select: { locale: true; name: true } } };
}>;
type AccountRow = Prisma.AccountGetPayload<Record<string, never>>;

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/(^|\s)(\p{L})/gu, (_, space: string, letter: string) => {
      return `${space}${letter.toUpperCase()}`;
    });
}

/**
 * Recurring payments detected in the user's movements (feature 15): rules
 * find them, the AI names and classifies each one once (cached in
 * RecurringSuggestionState), and the user accepts or dismisses them.
 */
@Injectable()
export class RecurringSuggestionsService {
  private readonly logger = new Logger(RecurringSuggestionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiModels: AiModelsService,
    private readonly recurring: RecurringExpensesService,
  ) {}

  async list(
    userId: string,
    accountId?: string,
    locale: AppLocale = DEFAULT_LOCALE,
  ): Promise<RecurringSuggestion[]> {
    const detected = await this.detect(userId, accountId);
    if (detected.length === 0) return [];

    const states = await this.states(userId, detected);
    const visible = detected.filter((suggestion) => {
      const state = states.get(suggestion.fingerprint);
      return !state?.dismissedAt && !state?.acceptedAt;
    });

    const pending = visible
      .filter((suggestion) => !states.get(suggestion.fingerprint)?.classifiedAt)
      .slice(0, MAX_AI_BATCH);
    if (pending.length > 0) {
      for (const row of await this.classify(userId, pending, locale)) {
        states.set(row.fingerprint, row);
      }
    }

    return this.present(visible, states);
  }

  async accept(
    userId: string,
    fingerprint: string,
    input: AcceptRecurringSuggestionInput = {},
  ): Promise<RecurringExpense> {
    this.assertFingerprint(fingerprint);
    const suggestion = (await this.detect(userId)).find(
      (s) => s.fingerprint === fingerprint,
    );
    if (!suggestion) {
      throw new NotFoundError('Recurring suggestion not found');
    }
    const state = await this.prisma.recurringSuggestionState.findUnique({
      where: { userId_fingerprint: { userId, fingerprint } },
    });

    const accountId = input.accountId ?? suggestion.accountId ?? undefined;
    const account = accountId
      ? await this.prisma.account.findFirst({
          where: { id: accountId, userId },
          select: { type: true },
        })
      : null;
    if (accountId && !account) throw new NotFoundError('Account not found');

    const frequency = input.frequency ?? suggestion.frequency;
    const interval = input.interval ?? suggestion.interval;
    const history = this.history(suggestion);
    const lastPaid = history[history.length - 1].dueDate;
    const earliest = history[0].dueDate;

    return this.recurring.createWithHistory(
      userId,
      {
        name:
          input.name?.trim() || state?.aiName || titleCase(suggestion.merchant),
        kind: input.kind ?? state?.aiKind ?? suggestion.kind,
        trackingMode:
          input.trackingMode ??
          (account?.type === AccountType.credit ||
          account?.type === AccountType.debit
            ? RecurringTrackingMode.automatic
            : RecurringTrackingMode.manual),
        frequency,
        interval,
        startDate: input.startDate ?? earliest,
        amount: input.amount ?? suggestion.amount,
        isVariableAmount: input.isVariableAmount ?? suggestion.isVariableAmount,
        currency: suggestion.currency,
        accountId,
        categoryId:
          input.categoryId ??
          state?.aiCategoryId ??
          suggestion.categoryId ??
          undefined,
        merchantPattern: suggestion.merchant,
      },
      history,
      {
        // Scheduled dates near the last charge are already paid by it.
        syncFrom: addDays(
          lastPaid,
          Math.ceil((FREQUENCY_DAYS[frequency] * interval) / 2),
        ),
        afterCreate: async (tx) => {
          await tx.recurringSuggestionState.upsert({
            where: { userId_fingerprint: { userId, fingerprint } },
            create: { userId, fingerprint, acceptedAt: new Date() },
            update: { acceptedAt: new Date() },
          });
        },
      },
    );
  }

  async dismiss(userId: string, fingerprint: string): Promise<boolean> {
    this.assertFingerprint(fingerprint);
    await this.prisma.recurringSuggestionState.upsert({
      where: { userId_fingerprint: { userId, fingerprint } },
      create: { userId, fingerprint, dismissedAt: new Date() },
      update: { dismissedAt: new Date() },
    });
    return true;
  }

  private assertFingerprint(fingerprint: string) {
    if (!FINGERPRINT.test(fingerprint)) {
      throw new ValidationError('Invalid suggestion id');
    }
  }

  /** Detected groups for the user (no AI). */
  private async detect(
    userId: string,
    accountId?: string,
  ): Promise<DetectedSuggestion[]> {
    const today = toDateOnly(new Date());
    const [transactions, existing] = await Promise.all([
      this.prisma.transaction.findMany({
        where: {
          userId,
          type: TransactionType.expense,
          isPending: false,
          txnDate: { gte: addDays(today, -SUGGESTION_LOOKBACK_DAYS) },
          // Already linked to a recurring payment, or part of a transfer.
          recurringPayment: { is: null },
          transferFrom: { is: null },
          transferTo: { is: null },
          ...(accountId && { accountId }),
        },
        select: {
          id: true,
          txnDate: true,
          amount: true,
          currency: true,
          accountId: true,
          categoryId: true,
          merchantName: true,
          description: true,
          source: true,
          aliasName: true,
          isPrivate: true,
          alias: { select: { displayName: true, isPrivate: true } },
        },
      }),
      this.prisma.recurringExpense.findMany({
        where: { userId },
        select: { name: true, merchantPattern: true },
      }),
    ]);

    return detectRecurring(
      transactions.map((t) => {
        // Merchant aliases (feature 17): group and name by the display name,
        // and never expose the original text of private movements.
        const aliased = Boolean(t.aliasName?.trim() || t.alias || t.isPrivate);
        const shown = aliased
          ? presentTransaction({
              merchantName: t.merchantName,
              description: t.description,
              aliasName: t.aliasName ?? null,
              isPrivate: t.isPrivate ?? false,
              alias: t.alias,
            })
          : null;
        return {
          id: t.id,
          date: t.txnDate,
          amount: Number(t.amount),
          currency: t.currency,
          accountId: t.accountId,
          categoryId: t.categoryId,
          merchantName: shown ? shown.displayName : t.merchantName,
          description: shown ? null : t.description,
          source: t.source,
        };
      }),
      { userId, today, existing },
    );
  }

  private async states(
    userId: string,
    suggestions: DetectedSuggestion[],
  ): Promise<Map<string, StateRow>> {
    const rows = await this.prisma.recurringSuggestionState.findMany({
      where: {
        userId,
        fingerprint: { in: suggestions.map((s) => s.fingerprint) },
      },
    });
    return new Map(rows.map((row) => [row.fingerprint, row]));
  }

  /** One paid occurrence per date (the charge closest to the median). */
  private history(suggestion: DetectedSuggestion): PaidHistoryItem[] {
    const byDate = new Map<number, DetectedSuggestion['occurrences'][number]>();
    for (const occurrence of suggestion.occurrences) {
      const key = occurrence.date.getTime();
      const current = byDate.get(key);
      if (
        !current ||
        Math.abs(occurrence.amount - suggestion.amount) <
          Math.abs(current.amount - suggestion.amount)
      ) {
        byDate.set(key, occurrence);
      }
    }
    return [...byDate.values()]
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((occurrence) => ({
        transactionId: occurrence.transactionId,
        dueDate: occurrence.date,
        amount: occurrence.amount,
        matchedBy:
          occurrence.source === TransactionSource.imported
            ? OccurrenceMatchSource.bank
            : occurrence.source === TransactionSource.statement
              ? OccurrenceMatchSource.statement
              : OccurrenceMatchSource.manual,
      }));
  }

  /**
   * Names and classifies the suggestions with one AI call and stores the
   * answer. Never throws: without AI (off, no model, error, timeout) the
   * rules-based values are shown and the next request tries again.
   */
  private async classify(
    userId: string,
    suggestions: DetectedSuggestion[],
    locale: AppLocale,
  ): Promise<StateRow[]> {
    try {
      const categories = await this.userCategories(userId);
      const categoryRefs = new Map<string, string>();
      const byId = new Map(categories.map((c) => [c.id, c]));
      const spanishName = (category: CategoryRow) =>
        category.translations.find((t) => t.locale === 'es')?.name ??
        category.name;
      const categoryList = categories.map((category, index) => {
        const ref = `c${index + 1}`;
        categoryRefs.set(ref, category.id);
        const parent = category.parentId ? byId.get(category.parentId) : null;
        return {
          id: ref,
          name: parent
            ? `${spanishName(parent)} > ${spanishName(category)}`
            : spanishName(category),
        };
      });
      const payments = suggestions.map((suggestion, index) => ({
        ref: `s${index + 1}`,
        merchant: suggestion.merchant,
        amount: suggestion.amount,
        currency: suggestion.currency,
        frequency: suggestion.frequency,
        variableAmount: suggestion.isVariableAmount,
        timesSeen: suggestion.occurrences.length,
      }));

      const { model, data } = await this.withTimeout(
        this.aiModels.extractFromText(
          {
            prompt: AI_PROMPT.replace('{{language}}', LANGUAGE[locale]),
            text: JSON.stringify({ payments, categories: categoryList }),
            schema: AI_SCHEMA,
            schemaName: 'classify_recurring_payments',
            timeoutMs: AI_TIMEOUT_MS,
          },
          { feature: AiFeatureKey.recurring_classification },
        ),
      );

      const answers = this.parseAnswer(data, payments.length, categoryRefs);
      const classifiedAt = new Date();
      const rows = await this.prisma.$transaction(
        [...answers].map(([index, answer]) => {
          const fingerprint = suggestions[index].fingerprint;
          const values = { ...answer, aiModel: model.modelId, classifiedAt };
          return this.prisma.recurringSuggestionState.upsert({
            where: { userId_fingerprint: { userId, fingerprint } },
            create: { userId, fingerprint, ...values },
            update: values,
          });
        }),
      );
      return rows;
    } catch (error) {
      this.logger.warn(
        `Recurring suggestions not classified by AI: ${(error as Error).message}`,
      );
      return [];
    }
  }

  /** Valid answers by suggestion index; anything malformed is dropped. */
  private parseAnswer(
    data: unknown,
    count: number,
    categoryRefs: Map<string, string>,
  ): Map<number, AiClassification> {
    const result = new Map<number, AiClassification>();
    const items = (data as { payments?: unknown } | null)?.payments;
    if (!Array.isArray(items)) return result;

    for (const item of items as Record<string, unknown>[]) {
      if (!item || typeof item !== 'object') continue;
      const match =
        typeof item.ref === 'string' ? /^s(\d+)$/.exec(item.ref.trim()) : null;
      const index = match ? Number(match[1]) - 1 : -1;
      if (index < 0 || index >= count || result.has(index)) continue;

      const name =
        typeof item.name === 'string'
          ? item.name.trim().slice(0, MAX_NAME_LENGTH)
          : '';
      const kind = AI_KINDS.find((k) => k === item.kind) ?? null;
      const categoryId =
        typeof item.categoryId === 'string'
          ? (categoryRefs.get(item.categoryId.trim()) ?? null)
          : null;
      result.set(index, {
        aiName: name || null,
        aiKind: kind,
        aiCategoryId: categoryId,
      });
    }
    return result;
  }

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`timed out after ${AI_TIMEOUT_MS} ms`)),
        AI_TIMEOUT_MS,
      );
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  /** The user's own categories plus the global defaults. */
  private userCategories(userId: string): Promise<CategoryRow[]> {
    return this.prisma.category.findMany({
      where: { OR: [{ userId }, { userId: null, isDefault: true }] },
      include: { translations: { select: { locale: true, name: true } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  private async present(
    suggestions: DetectedSuggestion[],
    states: Map<string, StateRow>,
  ): Promise<RecurringSuggestion[]> {
    const categoryIds = new Set<string>();
    const accountIds = new Set<string>();
    for (const suggestion of suggestions) {
      const state = states.get(suggestion.fingerprint);
      const categoryId = state?.aiCategoryId ?? suggestion.categoryId;
      if (categoryId) categoryIds.add(categoryId);
      if (suggestion.accountId) accountIds.add(suggestion.accountId);
    }
    const [categories, accounts]: [CategoryRow[], AccountRow[]] =
      await Promise.all([
        this.prisma.category.findMany({
          where: { id: { in: [...categoryIds] } },
          include: { translations: { select: { locale: true, name: true } } },
        }),
        this.prisma.account.findMany({
          where: { id: { in: [...accountIds] } },
        }),
      ]);
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const accountById = new Map(accounts.map((a) => [a.id, a]));

    return suggestions.map((suggestion) => {
      const state = states.get(suggestion.fingerprint);
      const categoryId = state?.aiCategoryId ?? suggestion.categoryId;
      const category = categoryId ? categoryById.get(categoryId) : undefined;
      const account = suggestion.accountId
        ? accountById.get(suggestion.accountId)
        : undefined;
      const byAi = Boolean(
        state?.classifiedAt &&
        (state.aiName || state.aiKind || state.aiCategoryId),
      );
      return {
        fingerprint: suggestion.fingerprint,
        merchant: suggestion.merchant,
        suggestedName: state?.aiName || titleCase(suggestion.merchant),
        kind: state?.aiKind ?? suggestion.kind,
        category: category ? this.mapCategory(category) : undefined,
        frequency: suggestion.frequency,
        interval: suggestion.interval,
        amount: suggestion.amount,
        isVariableAmount: suggestion.isVariableAmount,
        currency: suggestion.currency,
        account: account ? this.mapAccount(account) : undefined,
        nextDueDate: suggestion.nextDueDate,
        occurrences: suggestion.occurrences.map((o) => ({
          transactionId: o.transactionId,
          date: o.date,
          amount: o.amount,
        })),
        confidence: suggestion.confidence,
        classifiedBy: byAi ? 'ai' : null,
      };
    });
  }

  private mapCategory(row: CategoryRow): Category {
    return {
      id: row.id,
      name: row.name,
      key: row.key,
      originalName: row.name,
      parentId: row.parentId ?? undefined,
      sortOrder: row.sortOrder ?? undefined,
      isDefault: row.isDefault,
      userId: row.userId ?? undefined,
      createdAt: row.createdAt,
      translations: Object.fromEntries(
        row.translations.map((t) => [t.locale, t.name]),
      ),
    };
  }

  private mapAccount(row: AccountRow): Account {
    return {
      id: row.id,
      userId: row.userId,
      type: row.type,
      name: row.name,
      currency: row.currency,
      balanceCurrent: Number(row.balanceCurrent),
      metadata: row.metadata ? (row.metadata as AccountMetadata) : undefined,
      archived: row.archived,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
