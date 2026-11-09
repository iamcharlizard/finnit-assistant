import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { NotificationType } from '@finnit/database';

import { PrismaService } from '../../services/prisma.service';
import { CategorizationService } from '../categorization/categorization.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TransferSuggestionsService } from '../transfers/transfer-suggestions.service';
import { DuplicatesService } from '../duplicates/duplicates.service';
import { REVIEW_ENTITY_TYPE, reviewTexts } from './sync-review';
import { AutoCategorizeMode, SyncReviewService } from './sync-review.service';

describe('reviewTexts', () => {
  it('names both counts in Spanish', () => {
    expect(reviewTexts('es', { uncategorized: 12, transfers: 2 })).toEqual({
      title: 'Movimientos por revisar',
      message:
        'Tienes 12 movimientos sin clasificar y 2 posibles transferencias entre tus cuentas. Revísalos para que tus reportes cuadren.',
    });
  });

  it('uses the singular and leaves out a zero', () => {
    expect(reviewTexts('es', { uncategorized: 1, transfers: 0 }).message).toBe(
      'Tienes 1 movimiento sin clasificar. Revísalos para que tus reportes cuadren.',
    );
    expect(reviewTexts('en', { uncategorized: 0, transfers: 1 }).message).toBe(
      '1 movement looks like a transfer between your accounts. Review them so your reports add up.',
    );
  });
});

describe('SyncReviewService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let suggestions: DeepMockProxy<TransferSuggestionsService>;
  let categorization: DeepMockProxy<CategorizationService>;
  let notifications: DeepMockProxy<NotificationsService>;
  let duplicates: DeepMockProxy<DuplicatesService>;
  let service: SyncReviewService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    suggestions = mockDeep<TransferSuggestionsService>();
    categorization = mockDeep<CategorizationService>();
    notifications = mockDeep<NotificationsService>();
    duplicates = mockDeep<DuplicatesService>();
    duplicates.mergeIntoTransfers.mockResolvedValue([]);
    duplicates.detect.mockResolvedValue(0);
    prisma.user.findUnique.mockResolvedValue({ locale: 'es' } as never);
    service = new SyncReviewService(
      prisma,
      suggestions,
      categorization,
      notifications,
      duplicates,
    );
  });

  it('links bank movements to transfers recorded by hand before suggesting', async () => {
    duplicates.mergeIntoTransfers.mockResolvedValue(['t1']);
    suggestions.detect.mockResolvedValue(0);
    categorization.autoCategorize.mockResolvedValue({
      categorized: 0,
      remaining: 0,
    });
    suggestions.pendingCount.mockResolvedValue(0);

    await service.review('u1', ['t1', 't2']);

    expect(suggestions.detect).toHaveBeenCalledWith('u1', ['t2']);
    expect(duplicates.detect).toHaveBeenCalledWith('u1', ['t2']);
  });

  it('suggests transfers, categorizes, then updates the live notification', async () => {
    suggestions.detect.mockResolvedValue(1);
    categorization.autoCategorize.mockResolvedValue({
      categorized: 4,
      remaining: 3,
    });
    suggestions.pendingCount.mockResolvedValue(2);

    await expect(service.review('u1', ['t1', 't2'])).resolves.toEqual({
      transfersFound: 1,
      categorized: 4,
      uncategorized: 3,
      pendingTransfers: 2,
    });
    expect(suggestions.detect).toHaveBeenCalledWith('u1', ['t1', 't2']);
    expect(notifications.upsertLive).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        type: NotificationType.uncategorized,
        relatedEntityType: REVIEW_ENTITY_TYPE,
        relatedEntityId: 'u1',
        title: 'Movimientos por revisar',
      }),
    );
    expect(notifications.clearLive).not.toHaveBeenCalled();
  });

  it('clears the notification when nothing is left to review', async () => {
    suggestions.detect.mockResolvedValue(0);
    categorization.autoCategorize.mockResolvedValue({
      categorized: 2,
      remaining: 0,
    });
    suggestions.pendingCount.mockResolvedValue(0);

    await service.review('u1', []);
    expect(notifications.clearLive).toHaveBeenCalledWith(
      'u1',
      NotificationType.uncategorized,
      REVIEW_ENTITY_TYPE,
      'u1',
    );
    expect(notifications.upsertLive).not.toHaveBeenCalled();
  });

  it('categorizes on demand from history only, and clears the notification when nothing is left', async () => {
    categorization.autoCategorize.mockResolvedValue({
      categorized: 5,
      remaining: 0,
    });
    categorization.uncategorizedCount.mockResolvedValue(0);
    suggestions.pendingCount.mockResolvedValue(0);

    await expect(service.categorizeNow('u1')).resolves.toEqual({
      categorized: 5,
      suggested: 0,
      remaining: 0,
    });
    expect(categorization.suggestUncategorized).not.toHaveBeenCalled();
    expect(suggestions.detect).not.toHaveBeenCalled();
    expect(notifications.clearLive).toHaveBeenCalledWith(
      'u1',
      NotificationType.uncategorized,
      REVIEW_ENTITY_TYPE,
      'u1',
    );
  });

  it('only asks the AI for suggestions in AI mode', async () => {
    categorization.suggestUncategorized.mockResolvedValue(40);
    categorization.uncategorizedCount.mockResolvedValue(60);
    suggestions.pendingCount.mockResolvedValue(0);

    await expect(
      service.categorizeNow('u1', AutoCategorizeMode.ai),
    ).resolves.toEqual({ categorized: 0, suggested: 40, remaining: 60 });
    expect(categorization.autoCategorize).not.toHaveBeenCalled();
    expect(notifications.upsertLive).toHaveBeenCalled();
  });

  it('uses history first, then AI for the rest, in both mode', async () => {
    const order: string[] = [];
    categorization.autoCategorize.mockImplementation(async () => {
      order.push('history');
      return { categorized: 8, remaining: 20 };
    });
    categorization.suggestUncategorized.mockImplementation(async () => {
      order.push('ai');
      return 15;
    });
    categorization.uncategorizedCount.mockResolvedValue(20);
    suggestions.pendingCount.mockResolvedValue(0);

    await expect(
      service.categorizeNow('u1', AutoCategorizeMode.both),
    ).resolves.toEqual({ categorized: 8, suggested: 15, remaining: 20 });
    expect(order).toEqual(['history', 'ai']);
  });
});
