import { Injectable, Logger } from '@nestjs/common';
import { NotificationType } from '@finnit/database';

import { PrismaService } from '../../services/prisma.service';
import { CategorizationService } from '../categorization/categorization.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TransferSuggestionsService } from '../transfers/transfer-suggestions.service';
import { REVIEW_ENTITY_TYPE, reviewTexts } from './sync-review';

/** How "Clasificar automáticamente" works. */
export enum AutoCategorizeMode {
  /** The user's merchant rules, aliases and past categories (no AI). */
  history = 'history',
  /** AI suggestions for every uncategorized movement, to review. */
  ai = 'ai',
  /** History first, then AI suggestions for what is left. */
  both = 'both',
}

export interface SyncReview {
  /** New possible transfers found among the movements that arrived. */
  transfersFound: number;
  /** Movements categorized from the user's past categorizations. */
  categorized: number;
  /** Still without a category. */
  uncategorized: number;
  /** Possible transfers waiting for the user. */
  pendingTransfers: number;
}

/**
 * What runs after a bank sync: possible transfers among the new movements,
 * categories from past categorizations for every uncategorized movement,
 * and one live notification with what is left to review.
 */
@Injectable()
export class SyncReviewService {
  private readonly logger = new Logger(SyncReviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly transferSuggestions: TransferSuggestionsService,
    private readonly categorization: CategorizationService,
    private readonly notifications: NotificationsService,
  ) {}

  async review(userId: string, createdIds: string[]): Promise<SyncReview> {
    const transfersFound = await this.transferSuggestions.detect(
      userId,
      createdIds,
    );
    const { categorized, remaining } =
      await this.categorization.autoCategorize(userId);
    const pendingTransfers = await this.refreshNotice(userId, remaining);
    this.logger.log(
      `Sync review: ${transfersFound} possible transfers, ${categorized} categorized, ${remaining} uncategorized`,
    );
    return {
      transfersFound,
      categorized,
      uncategorized: remaining,
      pendingTransfers,
    };
  }

  /**
   * "Clasificar automáticamente", as the user chose: from their past
   * categorizations (applied), with AI (suggestions to review), or the
   * first then the AI for what is left. Refreshes the live notification.
   */
  async categorizeNow(
    userId: string,
    mode: AutoCategorizeMode = AutoCategorizeMode.history,
  ): Promise<{ categorized: number; suggested: number; remaining: number }> {
    let categorized = 0;
    if (mode !== AutoCategorizeMode.ai) {
      categorized = (await this.categorization.autoCategorize(userId))
        .categorized;
    }
    const suggested =
      mode === AutoCategorizeMode.history
        ? 0
        : await this.categorization.suggestUncategorized(userId);
    const remaining = await this.categorization.uncategorizedCount(userId);
    await this.refreshNotice(userId, remaining);
    return { categorized, suggested, remaining };
  }

  /**
   * Updates the live "to review" notification with what is left, or marks
   * it read when nothing is. Returns the pending transfer suggestions.
   */
  async refreshNotice(userId: string, uncategorized: number): Promise<number> {
    const pendingTransfers =
      await this.transferSuggestions.pendingCount(userId);
    if (uncategorized === 0 && pendingTransfers === 0) {
      await this.notifications.clearLive(
        userId,
        NotificationType.uncategorized,
        REVIEW_ENTITY_TYPE,
        userId,
      );
      return pendingTransfers;
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { locale: true },
    });
    await this.notifications.upsertLive({
      userId,
      type: NotificationType.uncategorized,
      relatedEntityType: REVIEW_ENTITY_TYPE,
      relatedEntityId: userId,
      ...reviewTexts(user?.locale ?? 'es', {
        uncategorized,
        transfers: pendingTransfers,
      }),
    });
    return pendingTransfers;
  }
}
