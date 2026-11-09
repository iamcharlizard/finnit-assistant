import { Module } from '@nestjs/common';

import { PrismaService } from '../../services/prisma.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { CreditCardRemindersService } from './credit-card-reminders.service';
import { CreditCardsResolver } from './credit-cards.resolver';
import { CreditCardsService } from './credit-cards.service';

/** Credit card billing cycles (periods, payments, interest) and reminders. */
@Module({
  imports: [NotificationsModule],
  providers: [
    CreditCardsResolver,
    CreditCardsService,
    CreditCardRemindersService,
    PrismaService,
  ],
  exports: [CreditCardsService],
})
export class CreditCardsModule {}
