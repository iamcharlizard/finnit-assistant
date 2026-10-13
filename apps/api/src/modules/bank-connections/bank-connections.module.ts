import { Module } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service';
import { StatementsModule } from '../statements/statements.module';
import { BankConnectionsResolver } from './bank-connections.resolver';
import { BankConnectionsScheduler } from './bank-connections.scheduler';
import { BankConnectionsService } from './bank-connections.service';
import { SyncfyClient } from './syncfy/syncfy.client';

@Module({
  imports: [StatementsModule],
  providers: [
    { provide: SyncfyClient, useFactory: () => new SyncfyClient() },
    BankConnectionsService,
    BankConnectionsResolver,
    BankConnectionsScheduler,
    PrismaService,
  ],
})
export class BankConnectionsModule {}
