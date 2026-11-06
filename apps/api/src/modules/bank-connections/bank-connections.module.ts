import { Module } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { StatementsModule } from '../statements/statements.module';
import { TransfersModule } from '../transfers/transfers.module';
import { CategorizationModule } from '../categorization/categorization.module';
import { SyncReviewService } from './sync-review.service';
import { SyncReviewResolver } from './sync-review.resolver';
import { BankConnectionsResolver } from './bank-connections.resolver';
import { BankConnectionsScheduler } from './bank-connections.scheduler';
import { BankConnectionsService } from './bank-connections.service';
import { SyncfyClient } from './syncfy/syncfy.client';

@Module({
  imports: [
    StatementsModule,
    NotificationsModule,
    TransfersModule,
    CategorizationModule,
  ],
  providers: [
    { provide: SyncfyClient, useFactory: () => new SyncfyClient() },
    BankConnectionsService,
    SyncReviewService,
    SyncReviewResolver,
    BankConnectionsResolver,
    BankConnectionsScheduler,
    PrismaService,
  ],
})
export class BankConnectionsModule {}
