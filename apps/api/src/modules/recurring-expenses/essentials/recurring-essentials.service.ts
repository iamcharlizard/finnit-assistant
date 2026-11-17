import { Injectable, Logger } from '@nestjs/common';
import { AiFeatureKey, RecurringExpenseKind } from '@finnit/database';

import { PrismaService } from '../../../services/prisma.service';
import { ValidationError } from '../../../common/exceptions/graphql-error.exception';
import { AiModelsService } from '../../ai/ai-models.service';
import { monthlyEquivalent } from '../schedule.util';
import {
  ESSENTIALS_PROMPT,
  ESSENTIALS_SCHEMA,
  essentialsRequest,
  parseEssentials,
  storedAnswers,
  validAnswers,
  type EssentialAnswers,
} from './recurring-essentials';
import {
  EssentialsClassification,
  RecurringEssentialProfile,
} from './dto/essentials.dto';

const AI_TIMEOUT_MS = 30_000;
/** Expenses per AI call (a long list is split). */
const BATCH = 40;

/**
 * The questionnaire's answers and the AI's essential / reducible /
 * dispensable judgment of each active recurring expense. Loans and card
 * purchases in installments are left out: they are debts, not choices.
 */
@Injectable()
export class RecurringEssentialsService {
  private readonly logger = new Logger(RecurringEssentialsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiModels: AiModelsService,
  ) {}

  async profile(userId: string): Promise<RecurringEssentialProfile | null> {
    const row = await this.prisma.recurringEssentialProfile.findUnique({
      where: { userId },
    });
    if (!row) return null;
    return {
      answers: Object.entries(storedAnswers(row.answers)).map(
        ([question, answer]) => ({ question, answer: answer }),
      ),
      updatedAt: row.updatedAt,
    };
  }

  /** Saves the answers and classifies every expense again with them. */
  async saveProfile(
    userId: string,
    input: ReadonlyArray<{ question: string; answer: string }>,
  ): Promise<EssentialsClassification> {
    const answers = validAnswers(input);
    if (!answers) {
      throw new ValidationError(
        'Answer every question with one of its options',
      );
    }
    await this.prisma.recurringEssentialProfile.upsert({
      where: { userId },
      create: { userId, answers: answers },
      update: { answers: answers },
    });
    return this.classify(userId, { onlyMissing: false });
  }

  /**
   * Asks the AI about the active recurring expenses (only the ones not
   * analyzed yet with `onlyMissing`). Without answers nothing happens.
   */
  async classify(
    userId: string,
    { onlyMissing }: { onlyMissing: boolean },
  ): Promise<EssentialsClassification> {
    const [profile, user] = await Promise.all([
      this.prisma.recurringEssentialProfile.findUnique({ where: { userId } }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { locale: true },
      }),
    ]);
    if (!profile) return { classified: 0, aiUnavailable: false };
    const answers = storedAnswers(profile.answers);
    const expenses = await this.prisma.recurringExpense.findMany({
      where: {
        userId,
        active: true,
        // Loans and card purchases in installments are debts, not choices.
        debtId: null,
        kind: { not: RecurringExpenseKind.loan },
        ...(onlyMissing && { essentialLevel: null }),
      },
      include: { category: { select: { name: true } } },
      orderBy: { name: 'asc' },
    });
    if (expenses.length === 0) return { classified: 0, aiUnavailable: false };

    let classified = 0;
    for (let i = 0; i < expenses.length; i += BATCH) {
      const batch = expenses.slice(i, i + BATCH);
      const levels = await this.ask(
        answers,
        batch.map((e) => ({
          id: e.id,
          name: e.name,
          kind: e.kind,
          category: e.category?.name ?? null,
          monthlyCost: monthlyEquivalent(
            Number(e.amount),
            e.frequency,
            e.interval,
          ),
          currency: e.currency,
        })),
        user?.locale ?? 'es',
      );
      if (levels === 'unavailable') {
        return { classified, aiUnavailable: true };
      }
      const at = new Date();
      for (const [id, { level, reason }] of levels) {
        await this.prisma.recurringExpense.update({
          where: { id },
          data: {
            essentialLevel: level,
            essentialReason: reason || null,
            essentialAt: at,
          },
        });
        classified += 1;
      }
    }
    return { classified, aiUnavailable: false };
  }

  private async ask(
    answers: EssentialAnswers,
    expenses: Parameters<typeof essentialsRequest>[1],
    locale: string,
  ): Promise<ReturnType<typeof parseEssentials> | 'unavailable'> {
    try {
      const { data } = await this.aiModels.extractFromText(
        {
          prompt: ESSENTIALS_PROMPT,
          text: essentialsRequest(answers, expenses, locale),
          schema: ESSENTIALS_SCHEMA,
          schemaName: 'recurring_essentials',
          timeoutMs: AI_TIMEOUT_MS,
        },
        { feature: AiFeatureKey.recurring_essentials },
      );
      return parseEssentials(data, new Set(expenses.map((e) => e.id)));
    } catch (error) {
      this.logger.warn(
        `Recurring essentials AI unavailable: ${(error as Error).message}`,
      );
      return 'unavailable';
    }
  }
}
