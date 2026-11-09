import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationType } from '@finnit/database';

import { PrismaService } from '../../services/prisma.service';
import { localToday } from '../../common/utils/local-date.util';
import { NotificationsService } from '../notifications/notifications.service';
import {
  payingCycle,
  remindersOn,
  type ReminderKind,
} from './credit-card-cycle';
import { CreditCardsService } from './credit-cards.service';
import { reminderTexts } from './reminder-texts';

/** The reminders' key: one per card, cut-off and kind. */
export const CARD_REMINDER_ENTITY = 'credit_card_cycle';

const TYPES: Record<ReminderKind, NotificationType> = {
  statement: NotificationType.card_statement,
  due_soon: NotificationType.card_due,
  due_today: NotificationType.card_due,
  unpaid: NotificationType.card_unpaid,
};

/**
 * Daily credit card reminders, from the cut-off and payment days the user
 * gave: the day after the cut-off, 3 days before and on the due date while
 * something is left to pay, and the day after when it wasn't covered.
 */
@Injectable()
export class CreditCardRemindersService {
  private readonly logger = new Logger(CreditCardRemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cards: CreditCardsService,
    private readonly notifications: NotificationsService,
  ) {}

  // In-process, like the recurring expenses job (one replica per environment).
  @Cron('0 6 * * *', {
    name: 'credit-card-reminders',
    timeZone: 'America/Mexico_City',
  })
  async runDaily(): Promise<void> {
    try {
      const created = await this.remind();
      this.logger.log(`Credit cards: ${created} reminders created`);
    } catch (error) {
      this.logger.error('Credit card reminders failed', error as Error);
    }
  }

  /** Creates today's reminders (never twice); returns how many. */
  async remind(
    today = localToday().toISOString().slice(0, 10),
  ): Promise<number> {
    const cards = await this.cards.cardsWithTerms();
    if (cards.length === 0) return 0;
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(cards.map((c) => c.userId))] } },
      select: { id: true, locale: true },
    });
    const locales = new Map(users.map((u) => [u.id, u.locale]));

    let created = 0;
    for (const card of cards) {
      const dates = payingCycle(today, card.terms);
      const [period] = await this.cards.figures(card, [dates], today);
      if (!period) continue;
      const cut = period.statementDate.toISOString().slice(0, 10);
      const due = period.paymentDueDate.toISOString().slice(0, 10);
      const kinds = remindersOn(today, {
        ...period,
        periodStart: period.periodStart.toISOString().slice(0, 10),
        statementDate: cut,
        paymentDueDate: due,
      });
      for (const kind of kinds) {
        const texts = reminderTexts(kind, locales.get(card.userId) ?? 'es', {
          card: card.name,
          currency: card.currency,
          amount:
            kind === 'statement' ? period.noInterestPayment : period.remaining,
          dueDate: due,
          manual: !card.connected,
        });
        const fresh = await this.notifications.notify({
          userId: card.userId,
          type: TYPES[kind],
          ...texts,
          relatedEntityType: CARD_REMINDER_ENTITY,
          relatedEntityId: `${card.id}:${cut}:${kind}`,
        });
        if (fresh) created++;
      }
    }
    return created;
  }
}
